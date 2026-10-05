import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";
import {
  isRetryableResearchError,
  retrieveAccountResearch,
} from "@/features/intelligence/server/openai-research";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const DISPATCH_TIMEOUT_MS = 60_000;

type ActiveJob = {
  id: string;
  provider_id: string;
  facility_id: string | null;
  model: string;
  response_id: string | null;
  requested_at: string;
  started_at: string | null;
};

type Transition = {
  providerId: string;
  status: "completed" | "failed";
};

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code).slice(0, 100)
    : "research_failed";
}

function publicFailureMessage(error: unknown, facilityId: string | null) {
  const scope = facilityId ? "facility" : "provider";
  const code = errorCode(error);
  if (code === "openai_incomplete_response" || code === "openai_empty_response") {
    return `Current public research did not return a complete evidence-backed ${scope} brief. Previous intelligence remains available, and retry is safe.`;
  }
  if (code === "openai_http_404") {
    return `The background ${scope} research result was no longer available to retrieve. Previous intelligence remains available, and retry is safe.`;
  }
  return `Current public research ended before a supported ${scope} brief could be saved. Previous intelligence remains available, and retry is safe.`;
}

async function terminalStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("account_research_jobs")
    .select("status")
    .eq("id", jobId)
    .eq("created_by", userId)
    .maybeSingle();
  return data?.status === "completed" || data?.status === "failed" ? data.status : null;
}

async function reconcileJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  job: ActiveJob,
): Promise<Transition | null> {
  // The manual action creates the database job before asking OpenAI to start.
  // A short null-ID window is therefore active dispatch, not an idle state.
  if (!job.response_id) {
    const dispatchStartedAt = new Date(job.started_at ?? job.requested_at).getTime();
    if (!Number.isFinite(dispatchStartedAt) || Date.now() - dispatchStartedAt <= DISPATCH_TIMEOUT_MS) return null;

    const { error: failureError } = await supabase.rpc("fail_account_research", {
      p_job_id: job.id,
      p_error_code: "research_dispatch_abandoned",
      p_error_message: "Background research was not accepted before the dispatch window closed. Previous intelligence remains available, and retry is safe.",
    });
    if (failureError) {
      const status = await terminalStatus(supabase, job.id, userId);
      if (status) return { providerId: job.provider_id, status };
      throw failureError;
    }
    return { providerId: job.provider_id, status: "failed" };
  }
  try {
    const progress = await retrieveAccountResearch(job.response_id, job.model);
    if (progress.status === "pending") return null;

    const result = progress.result;
    const { error } = await supabase.rpc("complete_account_research", {
      p_job_id: job.id,
      p_response_id: result.responseId,
      p_token_usage: JSON.parse(JSON.stringify(result.usage)),
      p_sources: result.brief.sources,
      p_claims: result.brief.claims,
    });
    if (error) {
      const status = await terminalStatus(supabase, job.id, userId);
      if (status) return { providerId: job.provider_id, status };
      throw error;
    }
    return { providerId: job.provider_id, status: "completed" };
  } catch (error) {
    if (isRetryableResearchError(error)) return null;

    const { error: failureError } = await supabase.rpc("fail_account_research", {
      p_job_id: job.id,
      p_error_code: errorCode(error),
      p_error_message: publicFailureMessage(error, job.facility_id),
    });
    if (failureError) {
      const status = await terminalStatus(supabase, job.id, userId);
      if (status) return { providerId: job.provider_id, status };
      throw failureError;
    }
    return { providerId: job.provider_id, status: "failed" };
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
  if (claimsError || !userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("account_research_jobs")
    .select("id, provider_id, facility_id, model, response_id, requested_at, started_at")
    .eq("created_by", userId)
    .eq("status", "running")
    .neq("model", "operator-curated")
    .order("requested_at", { ascending: true })
    .limit(4);
  if (error) {
    return NextResponse.json({ error: "Research status is temporarily unavailable." }, { status: 503 });
  }

  const jobs = (data ?? []) as ActiveJob[];
  const settled = await Promise.allSettled(jobs.map((job) => reconcileJob(supabase, userId, job)));
  const transitioned = settled.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );

  const { count, error: countError } = await supabase
    .from("account_research_jobs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .eq("status", "running")
    .neq("model", "operator-curated");

  return NextResponse.json(
    {
      // A count read may fail after a result was already persisted. Keep one
      // conservative polling cycle alive instead of silently abandoning any
      // remaining job or suppressing the transition refresh.
      active: countError ? true : (count ?? 0) > 0,
      transitioned,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
