"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { intelligenceActionContext } from "@/features/intelligence/server/action-context";
import { httpUrl, required, text } from "@/features/intelligence/server/action-input";
import {
  accountWorkspaceTab,
  researchPath,
} from "@/features/intelligence/server/action-navigation";
import { assertManualResearchIntent } from "@/features/intelligence/server/manual-research";
import {
  cancelAccountResearch,
  startAccountResearch,
} from "@/features/intelligence/server/openai-research";

function publicResearchError(error: unknown, scopeLabel: string) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "research_failed";
  if (code === "openai_key_missing") return `${scopeLabel} research is not configured in this local server.`;
  if (code === "openai_incomplete_response" || code === "openai_empty_response") {
    return `Current public research did not return a complete evidence-backed ${scopeLabel.toLowerCase()} brief.`;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return `${scopeLabel} research exceeded the safe time limit before a complete brief was available.`;
  }
  return `Current public research failed before a supported ${scopeLabel.toLowerCase()} brief could be saved.`;
}

export async function researchAccount(formData: FormData) {
  const { supabase } = await intelligenceActionContext();
  assertManualResearchIntent(formData);
  const providerId = required(formData, "provider_id");
  const facilityId = text(formData, "facility_id");
  const [providerResult, facilitiesResult, contactsResult, approvedFactsResult] = await Promise.all([
    supabase.from("providers").select("business_name, entity_name, abn, registration_status").eq("id", providerId).single(),
    supabase.from("facilities").select("id, name, full_address, suburb, postcode, acqsc_site_id").eq("provider_id", providerId).is("archived_at", null).order("name"),
    supabase.from("contacts").select("full_name, title, facility_id").eq("provider_id", providerId).eq("record_mode", "real").order("full_name"),
    supabase.from("commercial_account_facts").select("facility_id, statement, approved_at").eq("provider_id", providerId).eq("is_active", true).order("approved_at", { ascending: false }),
  ]);
  if (providerResult.error) throw new Error(providerResult.error.message);
  if (facilitiesResult.error) throw new Error(facilitiesResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  if (approvedFactsResult.error) throw new Error(approvedFactsResult.error.message);

  const facilities = (facilitiesResult.data ?? []).map((facility) => ({
    id: facility.id,
    name: facility.name,
    address: facility.full_address,
    suburb: facility.suburb,
    postcode: facility.postcode,
    acqsc_site_id: facility.acqsc_site_id,
  }));
  const targetFacility = facilityId ? facilities.find((facility) => facility.id === facilityId) ?? null : null;
  if (facilityId && !targetFacility) throw new Error("Facility not found for this provider.");
  const scopedContacts = (contactsResult.data ?? []).filter((contact) =>
    !facilityId || contact.facility_id === null || contact.facility_id === facilityId,
  );

  const [providerJobResult, scopeJobResult] = await Promise.all([
    supabase
      .from("account_research_jobs")
      .select("id")
      .eq("provider_id", providerId)
      .is("facility_id", null)
      .eq("status", "completed")
      .neq("model", "operator-curated")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    facilityId
      ? supabase
          .from("account_research_jobs")
          .select("id")
          .eq("provider_id", providerId)
          .eq("facility_id", facilityId)
          .eq("status", "completed")
          .neq("model", "operator-curated")
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : supabase
          .from("account_research_jobs")
          .select("id")
          .eq("provider_id", providerId)
          .is("facility_id", null)
          .eq("status", "completed")
          .neq("model", "operator-curated")
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);
  if (providerJobResult.error) throw new Error(providerJobResult.error.message);
  if (scopeJobResult.error) throw new Error(scopeJobResult.error.message);

  const priorJobIds = [...new Set([
    providerJobResult.data?.id,
    scopeJobResult.data?.id,
  ].filter((value): value is string => Boolean(value)))];
  const priorClaimsResult = priorJobIds.length
    ? await supabase
        .from("intelligence_claims")
        .select("research_job_id, statement, epistemic_state, observed_at, review_status")
        .in("research_job_id", priorJobIds)
        .eq("review_status", "pending")
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [], error: null };
  if (priorClaimsResult.error) throw new Error(priorClaimsResult.error.message);
  const priorClaims = priorClaimsResult.data ?? [];
  const approvedFacts = approvedFactsResult.data ?? [];
  const priorResearch = (jobId: string | undefined) => priorClaims
    .filter((claim) => claim.research_job_id === jobId)
    .map(({ statement, epistemic_state, observed_at }) => ({
      statement,
      epistemic_state,
      observed_at,
      knowledge_layer: "research" as const,
    }));
  const commercialFacts = (targetFacilityId: string | null) => approvedFacts
    .filter((fact) => fact.facility_id === targetFacilityId)
    .map((fact) => ({
      statement: fact.statement,
      epistemic_state: "known",
      observed_at: fact.approved_at.slice(0, 10),
      knowledge_layer: "human_approved_commercial" as const,
    }));

  const model = process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5.6-terra";
  const contextSnapshot = {
    scope: facilityId ? "facility" as const : "provider" as const,
    provider: providerResult.data,
    facilities,
    target_facility: targetFacility,
    existing_contacts: scopedContacts,
    existing_provider_intelligence: [
      ...priorResearch(providerJobResult.data?.id),
      ...commercialFacts(null),
    ],
    previous_scope_intelligence: facilityId
      ? [
          ...priorResearch(scopeJobResult.data?.id),
          ...commercialFacts(facilityId),
        ]
      : [],
  };
  const { data: jobId, error: startError } = await supabase.rpc("start_scoped_account_research", {
    p_provider_id: providerId,
    p_facility_id: facilityId ?? undefined,
    p_model: model,
    p_request_context: {
      workflow: facilityId ? "research_facility" : "research_provider",
      scope: facilityId ? "facility" : "provider",
      source: "interactive",
      version: "3.0-background",
    },
    p_provider_snapshot: contextSnapshot,
  });
  if (startError || !jobId) {
    if (startError?.message.includes("already running")) {
      redirect(researchPath({ providerId, facilityId, alert: startError.message }));
    }
    throw new Error(startError?.message ?? "Research job could not be started.");
  }

  let responseId: string | null = null;
  try {
    const started = await startAccountResearch(contextSnapshot);
    responseId = started.responseId;
    const { error } = await supabase.rpc("attach_account_research_response", {
      p_job_id: jobId,
      p_response_id: responseId,
    });
    if (error) throw error;
  } catch (error) {
    if (responseId) await cancelAccountResearch(responseId);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "research_failed";
    const scopeLabel = facilityId ? "Facility" : "Provider";
    const message = publicResearchError(error, scopeLabel);
    const { error: failureWriteError } = await supabase.rpc("fail_account_research", {
      p_job_id: jobId,
      p_error_code: code,
      p_error_message: message,
    });
    revalidatePath(`/providers/${providerId}`);
    const alert = failureWriteError
      ? `${message} Previous intelligence remains available, but this run could not be closed. Reload and retry after five minutes.`
      : `${message} Previous intelligence remains available, and retry is safe.`;
    redirect(researchPath({ providerId, facilityId, alert }));
  }

  revalidatePath(`/providers/${providerId}`);
  const scopeLabel = facilityId ? "Facility" : "Provider";
  redirect(researchPath({
    providerId,
    facilityId,
    notice: `${scopeLabel} research started in the background. You can continue using the workspace; the brief will update automatically when it finishes.`,
  }));
}

export async function addManualIntelligence(formData: FormData) {
  const { supabase } = await intelligenceActionContext();
  const providerId = required(formData, "provider_id");
  const facilityId = text(formData, "facility_id");
  const sourceUrl = httpUrl(formData, "source_url");
  if (!sourceUrl) throw new Error("A source URL is required.");
  const source = {
    title: required(formData, "source_title"),
    publisher: text(formData, "publisher"),
    url: sourceUrl,
    source_type: text(formData, "source_type") ?? "other",
    published_at: text(formData, "published_at"),
    updated_at: text(formData, "source_updated_at"),
    excerpt: text(formData, "excerpt"),
  };
  const claim = {
    category: required(formData, "category"),
    section: required(formData, "section"),
    statement: required(formData, "statement"),
    epistemic_state: required(formData, "epistemic_state"),
    confidence: required(formData, "confidence"),
    person_name: text(formData, "person_name"),
    person_title: text(formData, "person_title"),
    potential_relevance: text(formData, "potential_relevance"),
    observed_at: text(formData, "observed_at"),
    source_urls: [sourceUrl],
  };
  const { data: jobId, error: startError } = await supabase.rpc("start_scoped_account_research", {
    p_provider_id: providerId,
    p_facility_id: facilityId ?? undefined,
    p_model: "operator-curated",
    p_request_context: { workflow: "manual_evidence_capture", version: "1.0" },
    p_provider_snapshot: {},
  });
  if (startError || !jobId) throw new Error(startError?.message ?? "Evidence capture could not be started.");
  const { error: completionError } = await supabase.rpc("complete_account_research", {
    p_job_id: jobId,
    p_response_id: "",
    p_token_usage: {},
    p_sources: [source],
    p_claims: [claim],
  });
  if (completionError) {
    const { error: failureWriteError } = await supabase.rpc("fail_account_research", {
      p_job_id: jobId,
      p_error_code: "manual_evidence_failed",
      p_error_message: "Sourced evidence could not be saved; no partial finding was promoted.",
    });
    revalidatePath(`/providers/${providerId}`);
    const alert = failureWriteError
      ? "Sourced evidence could not be saved, and the run could not be closed. Reload and retry after five minutes."
      : "Sourced evidence could not be saved. No partial finding was promoted, and retry is safe.";
    redirect(researchPath({ providerId, facilityId, alert }));
  }
  revalidatePath(`/providers/${providerId}`);
  redirect(researchPath({ providerId, facilityId, notice: "Evidence captured and ready for human review." }));
}

export async function reviewIntelligenceClaim(formData: FormData) {
  const { supabase } = await intelligenceActionContext();
  const providerId = required(formData, "provider_id");
  const facilityId = text(formData, "facility_id");
  const returnFacilityId = text(formData, "return_facility_id") ?? facilityId;
  const { error } = await supabase.rpc("review_intelligence_claim", {
    p_claim_id: required(formData, "claim_id"),
    p_action: required(formData, "review_action"),
    p_corrected_statement: text(formData, "corrected_statement") ?? undefined,
    p_note: text(formData, "review_note") ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/providers/${providerId}`);
  redirect(researchPath({ providerId, facilityId: returnFacilityId, tab: accountWorkspaceTab(text(formData, "return_tab")), notice: "Intelligence review recorded." }));
}
