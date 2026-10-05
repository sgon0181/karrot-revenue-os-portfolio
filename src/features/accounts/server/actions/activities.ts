"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountActionContext } from "@/features/accounts/server/actions/context";
import { required, text } from "@/features/accounts/server/actions/input";
import { providerRecordMode } from "@/features/accounts/server/provider-record-mode";
import {
  commercialMessagePath,
  researchPath,
  verifiedMutationReturnOpportunityId,
} from "@/features/accounts/server/actions/navigation";
import { sydneyLocalDateTimeToIso } from "@/shared/lib/format";
import { logActivityReturnPath } from "@/shared/lib/internal-navigation";

export async function logActivity(formData: FormData) {
  const { supabase } = await accountActionContext();
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
  const returnTo = logActivityReturnPath(
    formData,
    providerId,
    verifiedReturnOpportunityId,
  );
  const { error } = await supabase.from("activities").insert({
    provider_id: providerId,
    facility_id: text(formData, "facility_id"),
    opportunity_id: opportunityId,
    contact_id: text(formData, "contact_id"),
    activity_type: required(formData, "activity_type"),
    subject: required(formData, "subject"),
    notes: text(formData, "notes"),
    occurred_at: sydneyLocalDateTimeToIso(text(formData, "occurred_at")) ?? new Date().toISOString(),
    record_mode: mode,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/providers/${providerId}`);
  if (opportunityId) revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  const returnFacilityId = text(formData, "return_facility_id");
  const fallbackDestination = !opportunityId && returnFacilityId
    ? researchPath({ providerId, facilityId: returnFacilityId })
    : opportunityId ? `/opportunities/${opportunityId}` : `/providers/${providerId}`;
  redirect(commercialMessagePath(returnTo ?? fallbackDestination, "notice", "Activity logged."));
}
