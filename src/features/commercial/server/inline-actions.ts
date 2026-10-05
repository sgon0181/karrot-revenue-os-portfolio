"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";
import type { InlineActionState } from "@/features/commercial/lib/optimistic-interactions";

function text(formData: FormData, key: string) {
  const values = formData.getAll(key);
  if (values.length !== 1) return null;
  const value = String(values[0] ?? "").trim();
  return value || null;
}

function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error("invalid_input");
  return value;
}

function error(message: string): InlineActionState {
  return { status: "error", message };
}

function success(message: string): InlineActionState {
  return { status: "success", message };
}

async function editorContext() {
  const principal = await getAuthenticatedPrincipal();
  if (principal.role !== "owner" && principal.role !== "editor") return null;
  return createClient();
}

export async function moveOpportunityStageInline(
  _previousState: InlineActionState,
  formData: FormData,
): Promise<InlineActionState> {
  const supabase = await editorContext();
  if (!supabase) return error("Editor or owner access is required to move opportunities.");

  let opportunityId: string;
  let providerId: string;
  let expectedStageId: string;
  let stageId: string;
  try {
    opportunityId = required(formData, "opportunity_id");
    providerId = required(formData, "provider_id");
    expectedStageId = required(formData, "expected_stage_id");
    stageId = required(formData, "stage_id");
  } catch {
    return error("The move request is incomplete. Reload the pipeline and try again.");
  }

  const [opportunityResult, stageResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("stage_id, pipeline_stages(is_active, outcome)")
      .eq("id", opportunityId)
      .eq("provider_id", providerId)
      .maybeSingle(),
    supabase
      .from("pipeline_stages")
      .select("id, name, outcome, is_active")
      .eq("id", stageId)
      .maybeSingle(),
  ]);

  if (opportunityResult.error || !opportunityResult.data) {
    return error("The opportunity is no longer available for this provider. Reload and try again.");
  }
  if (opportunityResult.data.stage_id !== expectedStageId) {
    revalidatePath("/pipeline");
    return error("The opportunity changed elsewhere and was not moved. The board has been refreshed.");
  }
  if (
    !opportunityResult.data.pipeline_stages?.is_active
    || opportunityResult.data.pipeline_stages.outcome
  ) {
    revalidatePath("/pipeline");
    return error("The opportunity is no longer in an active pipeline stage. The board has been refreshed.");
  }
  if (stageResult.error || !stageResult.data?.is_active || stageResult.data.outcome) {
    return error("Choose an active pipeline stage. Close Won or Lost from the opportunity workspace.");
  }

  if (opportunityResult.data.stage_id !== stageId) {
    const updateResult = await supabase
      .from("opportunities")
      .update({ stage_id: stageId, closed_lost_reason: null })
      .eq("id", opportunityId)
      .eq("provider_id", providerId)
      .eq("stage_id", expectedStageId)
      .select("id")
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      revalidatePath("/pipeline");
      return error("The opportunity changed elsewhere and was not moved. The board has been refreshed.");
    }
  }

  for (const path of [
    `/providers/${providerId}`,
    "/pipeline",
    "/customers",
    "/dashboard",
    `/opportunities/${opportunityId}`,
  ]) {
    revalidatePath(path);
  }
  return success(
    opportunityResult.data.stage_id === stageId
      ? `Already in ${stageResult.data.name}.`
      : `Moved to ${stageResult.data.name}.`,
  );
}

export async function completeNextActionInline(
  _previousState: InlineActionState,
  formData: FormData,
): Promise<InlineActionState> {
  const supabase = await editorContext();
  if (!supabase) return error("Editor or owner access is required to complete tasks.");

  let actionId: string;
  let providerId: string;
  try {
    actionId = required(formData, "action_id");
    providerId = required(formData, "provider_id");
  } catch {
    return error("The completion request is incomplete. Reload Tasks and try again.");
  }
  const completedAt = new Date().toISOString();
  const updateResult = await supabase
    .from("next_actions")
    .update({ status: "completed", completed_at: completedAt })
    .eq("id", actionId)
    .eq("provider_id", providerId)
    .eq("status", "open")
    .select("id, opportunity_id")
    .maybeSingle();

  if (updateResult.error) {
    return error("The task was not completed. Reload Tasks and try again.");
  }

  let opportunityId = updateResult.data?.opportunity_id ?? null;
  if (!updateResult.data) {
    const currentResult = await supabase
      .from("next_actions")
      .select("status, opportunity_id")
      .eq("id", actionId)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (currentResult.error || currentResult.data?.status !== "completed") {
      revalidatePath("/tasks");
      return error("The task is no longer available. The queue has been refreshed.");
    }
    opportunityId = currentResult.data.opportunity_id;
  }

  revalidatePath(`/providers/${providerId}`);
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  return success(updateResult.data ? "Task completed." : "Task was already complete.");
}
