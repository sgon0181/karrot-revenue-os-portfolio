"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountActionContext } from "@/features/accounts/server/actions/context";
import { required, text } from "@/features/accounts/server/actions/input";
import { providerRecordMode } from "@/features/accounts/server/provider-record-mode";
import {
  commercialMessagePath,
  researchPath,
  validatedFormReturnTo,
  verifiedMutationReturnOpportunityId,
} from "@/features/accounts/server/actions/navigation";
import { sydneyLocalDateTimeToIso } from "@/shared/lib/format";
import {
  createNextActionReturnPath,
  samePathInternalPath,
  validatedTasksPath,
} from "@/shared/lib/internal-navigation";

export async function createNextAction(formData: FormData) {
  const { supabase, user } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const opportunityId = text(formData, "opportunity_id");
  let mode = await providerRecordMode(supabase, providerId);
  if (opportunityId) {
    const { data: opportunity, error: opportunityError } = await supabase
      .from("opportunities")
      .select("record_mode")
      .eq("id", opportunityId)
      .eq("provider_id", providerId)
      .single();
    if (opportunityError) throw new Error(opportunityError.message);
    mode = opportunity.record_mode === "sandbox" ? "sandbox" : "real";
  }
  const verifiedReturnOpportunityId = await verifiedMutationReturnOpportunityId(
    supabase,
    formData,
    providerId,
    opportunityId,
  );
  const returnTo = createNextActionReturnPath(
    formData,
    providerId,
    verifiedReturnOpportunityId,
  );
  const { error } = await supabase.from("next_actions").insert({
    provider_id: providerId,
    opportunity_id: opportunityId,
    contact_id: text(formData, "contact_id"),
    title: required(formData, "title"),
    due_at: sydneyLocalDateTimeToIso(text(formData, "due_at")),
    priority: text(formData, "priority") ?? "normal",
    assigned_to: user.id,
    notes: text(formData, "notes"),
    record_mode: mode,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/providers/${providerId}`);
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  const returnFacilityId = text(formData, "return_facility_id");
  const fallbackDestination = !opportunityId && returnFacilityId
    ? researchPath({ providerId, facilityId: returnFacilityId })
    : opportunityId ? `/opportunities/${opportunityId}` : `/providers/${providerId}`;
  redirect(commercialMessagePath(returnTo ?? fallbackDestination, "notice", "Next action added."));
}

export async function completeNextAction(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const opportunityId = text(formData, "opportunity_id");
  const { data: completedAction, error } = await supabase
    .from("next_actions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", required(formData, "action_id"))
    .eq("provider_id", providerId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!completedAction) throw new Error("The next action was not completed.");
  revalidatePath(`/providers/${providerId}`);
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  const returnTo = validatedFormReturnTo(formData);
  const opportunityDestination = opportunityId
    ? samePathInternalPath(returnTo, `/opportunities/${opportunityId}`)
    : null;
  const providerDestination = samePathInternalPath(returnTo, `/providers/${providerId}`);
  const destination = validatedTasksPath(returnTo)
    ?? opportunityDestination
    ?? providerDestination
    ?? `/providers/${providerId}`;
  redirect(commercialMessagePath(destination, "notice", "Next action completed."));
}

export async function rescheduleNextAction(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const opportunityId = text(formData, "opportunity_id");
  const dueAt = sydneyLocalDateTimeToIso(required(formData, "due_at"));
  const { data, error } = await supabase
    .from("next_actions")
    .update({ due_at: dueAt, status: "open", completed_at: null })
    .eq("id", required(formData, "action_id"))
    .eq("provider_id", providerId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The next action was not rescheduled.");
  revalidatePath(`/providers/${providerId}`);
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  const returnTo = validatedFormReturnTo(formData);
  const opportunityDestination = opportunityId
    ? samePathInternalPath(returnTo, `/opportunities/${opportunityId}`)
    : null;
  const providerDestination = samePathInternalPath(returnTo, `/providers/${providerId}`);
  const destination = validatedTasksPath(returnTo)
    ?? opportunityDestination
    ?? providerDestination
    ?? `/providers/${providerId}`;
  redirect(commercialMessagePath(destination, "notice", "Next action rescheduled."));
}
