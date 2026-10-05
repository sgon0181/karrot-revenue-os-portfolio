"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountActionContext } from "@/features/accounts/server/actions/context";
import type { AccountActionClient } from "@/features/accounts/server/actions/context";
import { numberValue, required, text } from "@/features/accounts/server/actions/input";
import {
  commercialAlertPath,
  commercialMessagePath,
} from "@/features/accounts/server/actions/navigation";
import {
  addCustomerFacilityReturnPath,
  updateCustomerReturnPath,
} from "@/shared/lib/internal-navigation";

async function customerFacilityBelongsToProvider(
  supabase: AccountActionClient,
  providerId: string,
  customerId: string,
  facilityId: string,
) {
  const [customerResult, facilityResult] = await Promise.all([
    supabase
      .from("customer_relationships")
      .select("id")
      .eq("id", customerId)
      .eq("provider_id", providerId)
      .maybeSingle(),
    supabase
      .from("facilities")
      .select("id")
      .eq("id", facilityId)
      .eq("provider_id", providerId)
      .maybeSingle(),
  ]);
  if (customerResult.error) throw new Error(customerResult.error.message);
  if (facilityResult.error) throw new Error(facilityResult.error.message);
  return Boolean(customerResult.data && facilityResult.data);
}

export async function updateCustomer(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const returnTo = updateCustomerReturnPath(formData, providerId);
  const { data: updatedCustomer, error } = await supabase
    .from("customer_relationships")
    .update({
      customer_since: text(formData, "customer_since"),
      contract_start_date: text(formData, "contract_start_date"),
      contract_end_date: text(formData, "contract_end_date"),
      renewal_date: text(formData, "renewal_date"),
      onboarding_state: text(formData, "onboarding_state"),
      status: required(formData, "status"),
      mrr: numberValue(formData, "mrr"),
      arr: numberValue(formData, "arr"),
      contracted_beds: numberValue(formData, "contracted_beds"),
      notes: text(formData, "notes"),
    })
    .eq("id", required(formData, "customer_id"))
    .eq("provider_id", providerId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!updatedCustomer) throw new Error("The customer relationship was not updated.");
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  redirect(commercialMessagePath(returnTo ?? `/providers/${providerId}`, "notice", "Customer relationship updated."));
}

export async function addCustomerFacility(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const customerId = required(formData, "customer_id");
  const facilityId = required(formData, "facility_id");
  const returnTo = addCustomerFacilityReturnPath(formData, providerId);
  const recordsBelongToProvider = await customerFacilityBelongsToProvider(
    supabase,
    providerId,
    customerId,
    facilityId,
  );
  if (!recordsBelongToProvider) {
    redirect(commercialAlertPath(
      returnTo ?? `/providers/${providerId}`,
      "The selected customer or facility is no longer available for this provider.",
    ));
  }
  const { data: savedFacility, error } = await supabase
    .from("customer_facilities")
    .insert({
      customer_relationship_id: customerId,
      facility_id: facilityId,
      status: required(formData, "status"),
      onboarding_state: text(formData, "onboarding_state"),
      contracted_beds: numberValue(formData, "contracted_beds"),
      live_beds: numberValue(formData, "live_beds"),
      contract_start_date: text(formData, "contract_start_date"),
      go_live_date: text(formData, "go_live_date"),
      notes: text(formData, "notes"),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!savedFacility) throw new Error("The customer facility was not added.");
  revalidatePath(`/providers/${providerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  redirect(commercialMessagePath(returnTo ?? `/providers/${providerId}`, "notice", "Customer facility saved."));
}
