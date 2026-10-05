"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { accountActionContext } from "@/features/accounts/server/actions/context";
import {
  httpUrl,
  readableInputError,
  required,
  text,
} from "@/features/accounts/server/actions/input";
import { providerRecordMode } from "@/features/accounts/server/provider-record-mode";
import {
  accountWorkspaceTab,
  commercialAlertPath,
  commercialMessagePath,
  researchPath,
} from "@/features/accounts/server/actions/navigation";
import { saveContactReturnPath } from "@/shared/lib/internal-navigation";

export async function saveContact(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const returnTo = saveContactReturnPath(formData, providerId);
  const errorDestination = returnTo ?? `/providers/${providerId}`;
  const contactId = text(formData, "contact_id");
  let payload;
  try {
    payload = {
      facility_id: text(formData, "facility_id"),
      full_name: required(formData, "full_name"),
      title: text(formData, "title"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      professional_profile_url: httpUrl(formData, "professional_profile_url"),
      role_category: text(formData, "role_category"),
      relationship_status: text(formData, "relationship_status"),
      source_type: text(formData, "source_type"),
      source_url: httpUrl(formData, "source_url"),
      last_verified_at: text(formData, "last_verified_at"),
      notes: text(formData, "notes"),
    };
  } catch (error) {
    redirect(commercialAlertPath(errorDestination, readableInputError(error)));
  }
  if (contactId) {
    const { data: existingContact, error: existingContactError } = await supabase
      .from("contacts")
      .select("record_mode")
      .eq("id", contactId)
      .eq("provider_id", providerId)
      .maybeSingle();
    if (existingContactError || !existingContact) {
      redirect(commercialAlertPath(errorDestination, "The contact could not be found."));
    }
    if (existingContact.record_mode !== "sandbox") {
      redirect(commercialAlertPath(errorDestination, "Contacts on registered provider accounts must be changed through Review details so earlier information remains auditable."));
    }
  }
  const mode = contactId ? null : await providerRecordMode(supabase, providerId);
  const { data: savedContactId, error } = contactId
    ? await supabase.rpc("update_sandbox_contact", {
        p_contact_id: contactId,
        p_provider_id: providerId,
        p_changes: payload,
      })
    : await supabase
        .from("contacts")
        .insert({ provider_id: providerId, record_mode: mode!, ...payload })
        .select("id")
        .single()
        .then(({ data, error: insertError }) => ({
          data: data?.id ?? null,
          error: insertError,
        }));
  if (error || !savedContactId) {
    redirect(commercialAlertPath(errorDestination, "The contact was not saved. Check the provider and facility selections, then try again."));
  }
  revalidatePath(`/providers/${providerId}`);
  const returnFacilityId = text(formData, "return_facility_id");
  const returnTab = text(formData, "return_tab");
  const successMessage = contactId ? "Contact updated." : payload.source_url ? "Sourced contact added." : "Contact added.";
  if (returnTo) {
    redirect(commercialMessagePath(returnTo, "notice", successMessage));
  }
  if (returnFacilityId || returnTab) {
    redirect(researchPath({ providerId, facilityId: returnFacilityId, tab: accountWorkspaceTab(returnTab), notice: successMessage }));
  }
  redirect(commercialMessagePath(`/providers/${providerId}`, "notice", contactId ? "Contact updated." : "Contact added."));
}

export async function proposeContactChange(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const contactId = required(formData, "contact_id");
  const proposedChanges: Record<string, string | null> = {};
  for (const field of ["full_name", "facility_id", "title", "email", "phone", "currentness_status"] as const) {
    const value = text(formData, field);
    if (value !== null) proposedChanges[field] = value;
  }
  const professionalProfileUrl = httpUrl(formData, "professional_profile_url");
  if (professionalProfileUrl !== null) {
    proposedChanges.professional_profile_url = professionalProfileUrl;
  }
  const { error } = await supabase.rpc("propose_contact_change", {
    p_contact_id: contactId,
    p_proposal_kind: Object.keys(proposedChanges).length ? "change" : "verification",
    p_proposed_changes: proposedChanges,
    p_observed_at: text(formData, "observed_at") ?? undefined,
    p_source_type: text(formData, "source_type") ?? undefined,
    p_source_url: httpUrl(formData, "source_url") ?? undefined,
    p_note: text(formData, "proposal_note") ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/providers/${providerId}`);
  const query = new URLSearchParams({ tab: "people", notice: "Contact change saved for review." });
  const facilityId = text(formData, "return_facility_id");
  if (facilityId) query.set("facility", facilityId);
  redirect(`/providers/${providerId}?${query.toString()}#contact-${contactId}`);
}

export async function reviewContactChange(formData: FormData) {
  const { supabase } = await accountActionContext();
  const providerId = required(formData, "provider_id");
  const contactId = required(formData, "contact_id");
  const { error } = await supabase.rpc("review_contact_change", {
    p_proposal_id: required(formData, "proposal_id"),
    p_action: required(formData, "review_action"),
    p_review_note: text(formData, "review_note") ?? undefined,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/providers/${providerId}`);
  const query = new URLSearchParams({ tab: "people", notice: "Contact change review recorded." });
  const facilityId = text(formData, "return_facility_id");
  if (facilityId) query.set("facility", facilityId);
  redirect(`/providers/${providerId}?${query.toString()}#contact-${contactId}`);
}
