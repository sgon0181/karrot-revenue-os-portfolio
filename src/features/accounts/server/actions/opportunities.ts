"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountActionContext } from "@/features/accounts/server/actions/context";
import { numberValue, required, text } from "@/features/accounts/server/actions/input";
import { providerRecordMode } from "@/features/accounts/server/provider-record-mode";
import {
  commercialAlertPath,
  commercialMessagePath,
  validatedFormReturnTo,
} from "@/features/accounts/server/actions/navigation";
import {
  createOpportunityReturnPath,
  samePathInternalPath,
  withReturnTo,
} from "@/shared/lib/internal-navigation";

export async function createOpportunity(formData: FormData) {
  const { supabase, user } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const returnTo = createOpportunityReturnPath(formData, providerId);
  const errorDestination = returnTo ?? `/providers/${providerId}`;
  const stageId = required(formData, "stage_id");
  const mode = await providerRecordMode(supabase, providerId);
  const { data: initialStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id, outcome, is_active")
    .eq("id", stageId)
    .maybeSingle();
  if (stageError || !initialStage?.is_active || initialStage.outcome) {
    redirect(commercialAlertPath(errorDestination, "Start a new opportunity in an active, non-terminal stage."));
  }
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .insert({
      provider_id: providerId,
      name: required(formData, "name"),
      stage_id: stageId,
      primary_contact_id: text(formData, "primary_contact_id"),
      owner_id: user.id,
      notes: text(formData, "notes"),
      estimated_value: numberValue(formData, "estimated_value"),
      estimated_beds: numberValue(formData, "estimated_beds"),
      expected_close_date: text(formData, "expected_close_date"),
      record_mode: mode,
    })
    .select("id")
    .single();
  if (error || !opportunity) {
    redirect(commercialAlertPath(errorDestination, "The opportunity was not created. Check the selected contact and try again."));
  }
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  redirect(commercialMessagePath(
    withReturnTo(`/opportunities/${opportunity.id}`, returnTo),
    "notice",
    "Opportunity created.",
  ));
}

export async function updateOpportunityStage(formData: FormData) {
  const { supabase } = await accountActionContext();
  const opportunityId = required(formData, "opportunity_id");
  const providerId = required(formData, "provider_id");
  const stageId = required(formData, "stage_id");
  const requestedDestination = validatedFormReturnTo(formData);
  const pipelineDestination = samePathInternalPath(requestedDestination, "/pipeline");
  const opportunityDestination = samePathInternalPath(requestedDestination, `/opportunities/${opportunityId}`);
  const destination = pipelineDestination
    ?? opportunityDestination
    ?? `/providers/${providerId}`;
  const { data: existing, error: readError } = await supabase
    .from("opportunities")
    .select("stage_id")
    .eq("id", opportunityId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (readError || !existing) {
    redirect(commercialAlertPath(destination, "The opportunity could not be found for this provider."));
  }

  const { data: targetStage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id, name, outcome, is_active")
    .eq("id", stageId)
    .maybeSingle();
  if (stageError || !targetStage?.is_active) {
    redirect(commercialAlertPath(destination, "Choose an active pipeline stage and try again."));
  }
  const lostReason = text(formData, "closed_lost_reason");
  if (targetStage.outcome === "lost" && !lostReason) {
    redirect(commercialAlertPath(destination, "Record why the opportunity was lost before closing it."));
  }

  if (existing.stage_id === stageId) {
    if (targetStage.outcome !== "lost") {
      redirect(commercialMessagePath(destination, "notice", "Stage unchanged."));
    }
    const { data: updatedReason, error: reasonError } = await supabase
      .from("opportunities")
      .update({ closed_lost_reason: lostReason })
      .eq("id", opportunityId)
      .eq("provider_id", providerId)
      .select("id")
      .single();
    if (reasonError || !updatedReason) {
      redirect(commercialAlertPath(destination, "The Closed Lost reason was not updated. Try again."));
    }
    revalidatePath(`/opportunities/${opportunityId}`);
    redirect(commercialMessagePath(destination, "notice", "Closed Lost reason updated."));
  }

  const { data: updatedOpportunity, error } = await supabase
    .from("opportunities")
    .update({
      stage_id: stageId,
      closed_lost_reason: targetStage.outcome === "lost" ? lostReason : null,
    })
    .eq("id", opportunityId)
    .eq("provider_id", providerId)
    .select("id")
    .single();
  if (error || !updatedOpportunity) {
    redirect(commercialAlertPath(destination, "The opportunity stage was not updated. Reload and try again."));
  }
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/pipeline");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath(`/opportunities/${opportunityId}`);
  redirect(commercialMessagePath(destination, "notice", "Opportunity stage updated."));
}

export async function updateOpportunity(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const opportunityId = required(formData, "opportunity_id");
  const returnTo = validatedFormReturnTo(formData);
  const destination = samePathInternalPath(returnTo, `/opportunities/${opportunityId}`)
    ?? `/opportunities/${opportunityId}`;
  const { data, error } = await supabase
    .from("opportunities")
    .update({
      name: required(formData, "name"),
      primary_contact_id: text(formData, "primary_contact_id"),
      notes: text(formData, "notes"),
      estimated_value: numberValue(formData, "estimated_value"),
      estimated_beds: numberValue(formData, "estimated_beds"),
      expected_close_date: text(formData, "expected_close_date"),
      problem_statement: text(formData, "problem_statement"),
      why_now: text(formData, "why_now"),
      champion_notes: text(formData, "champion_notes"),
      decision_process: text(formData, "decision_process"),
      blockers: text(formData, "blockers"),
    })
    .eq("id", opportunityId)
    .eq("provider_id", providerId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The opportunity was not updated.");
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/pipeline");
  redirect(commercialMessagePath(destination, "notice", "Opportunity updated."));
}
