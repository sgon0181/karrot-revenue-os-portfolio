import { loadCurrentResearchMemory } from "@/features/accounts/server/load-current-research";
import {
  loadResearchMemory,
  summarizeResearchMemory,
} from "@/features/accounts/server/load-research-memory";
import { providerRecordMode } from "@/features/accounts/server/provider-record-mode";
import type { ProviderWorkspaceTab } from "@/features/accounts/lib/provider-workspace-tabs";
import type { CommercialFact } from "@/features/intelligence/lib/types";
import type { createClient } from "@/infrastructure/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function throwResultErrors(results: Array<{ error: { message: string } | null }>) {
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
  }
}

export async function loadOverviewTab(
  supabase: SupabaseClient,
  providerId: string,
  selectedFacilityId: string | null,
) {
  const mode = await providerRecordMode(supabase, providerId);
  const [contactsResult, research] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, title")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("full_name")
      .limit(3),
    loadCurrentResearchMemory(supabase, providerId, selectedFacilityId),
  ]);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  return {
    contacts: contactsResult.data ?? [],
    researchJobs: research.jobs,
    intelligenceClaims: research.claims,
  };
}

export async function loadPeopleTab(
  supabase: SupabaseClient,
  providerId: string,
  selectedFacilityId: string | null,
) {
  const mode = await providerRecordMode(supabase, providerId);
  const [contactsResult, research] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("full_name"),
    loadCurrentResearchMemory(supabase, providerId, selectedFacilityId),
  ]);
  if (contactsResult.error) throw new Error(contactsResult.error.message);
  const contacts = contactsResult.data ?? [];
  const contactIds = contacts.map((contact) => contact.id);
  const proposalsResult = contactIds.length
    ? await supabase
        .from("contact_change_proposals")
        .select("*")
        .in("contact_id", contactIds)
        .order("proposed_at", { ascending: false })
    : { data: [], error: null };
  if (proposalsResult.error) throw new Error(proposalsResult.error.message);
  return {
    contacts,
    contactChangeProposals: proposalsResult.data ?? [],
    researchJobs: research.jobs,
    intelligenceClaims: research.claims,
  };
}

export async function loadIntelligenceTab(
  supabase: SupabaseClient,
  providerId: string,
) {
  const [researchMemory, approvedFactsResult] = await Promise.all([
    loadResearchMemory(supabase, providerId),
    supabase
      .from("commercial_account_facts")
      .select("id, facility_id, category, statement, confidence, approved_at")
      .eq("provider_id", providerId)
      .eq("is_active", true)
      .order("approved_at", { ascending: false }),
  ]);
  if (approvedFactsResult.error)
    throw new Error(approvedFactsResult.error.message);
  return {
    researchJobs: summarizeResearchMemory(researchMemory),
    intelligenceClaims: researchMemory.claims,
    approvedFacts: (approvedFactsResult.data ?? []) as CommercialFact[],
  };
}

export async function loadCommercialTab(
  supabase: SupabaseClient,
  providerId: string,
) {
  const mode = await providerRecordMode(supabase, providerId);
  const [
    contactsResult,
    opportunitiesResult,
    stagesResult,
    activitiesResult,
    actionsResult,
    customerResult,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("full_name"),
    supabase
      .from("opportunities")
      .select("*, pipeline_stages(*)")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("updated_at", { ascending: false }),
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("activities")
      .select("*, contacts(full_name)")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("occurred_at", { ascending: false })
      .limit(30),
    supabase
      .from("next_actions")
      .select("*")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("customer_relationships")
      .select("*")
      .eq("provider_id", providerId)
      .eq("record_mode", mode)
      .order("updated_at", { ascending: false }),
  ]);
  throwResultErrors([
    contactsResult,
    opportunitiesResult,
    stagesResult,
    activitiesResult,
    actionsResult,
    customerResult,
  ]);

  const customers = customerResult.data ?? [];
  const customer = customers[0] ?? null;
  const customerFacilitiesResult = customer
    ? await supabase
        .from("customer_facilities")
        .select("*, facilities(name, acqsc_site_id)")
        .eq("customer_relationship_id", customer.id)
        .order("created_at")
    : { data: [], error: null };
  if (customerFacilitiesResult.error)
    throw new Error(customerFacilitiesResult.error.message);
  const customerFacilities = customerFacilitiesResult.data ?? [];
  return {
    contacts: contactsResult.data ?? [],
    opportunities: opportunitiesResult.data ?? [],
    stages: stagesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    actions: actionsResult.data ?? [],
    customer,
    alternateCustomers: customer
      ? customers.filter((item) => item.id !== customer.id)
      : [],
    customerFacilities,
  };
}

export async function loadEvidenceTab(
  supabase: SupabaseClient,
  providerId: string,
) {
  const mode = await providerRecordMode(supabase, providerId);
  const [
    provenanceResult,
    researchMemory,
    approvedFactsResult,
    commercialFactHistoryResult,
    intelligenceReviewEventsResult,
    contactsResult,
  ] = await Promise.all([
    supabase
      .from("provider_snapshots")
      .select(
        "*, source_files(title, publisher, source_url, sha256, source_as_of_date), source_records(sheet_name, row_number)",
      )
      .eq("provider_id", providerId)
      .order("observed_at", { ascending: false }),
    loadResearchMemory(supabase, providerId),
    supabase
      .from("commercial_account_facts")
      .select("id, facility_id, category, statement, confidence, approved_at")
      .eq("provider_id", providerId)
      .eq("is_active", true)
      .order("approved_at", { ascending: false }),
    supabase
      .from("commercial_account_facts")
      .select(
        "id, source_claim_id, facility_id, category, statement, confidence, approved_at, is_active",
      )
      .eq("provider_id", providerId)
      .order("approved_at", { ascending: false }),
    supabase
      .from("intelligence_review_events")
      .select(
        "id, claim_id, action, previous_status, resulting_statement, note, reviewed_at, profiles(display_name)",
      )
      .eq("provider_id", providerId)
      .order("reviewed_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, full_name")
      .eq("provider_id", providerId)
      .eq("record_mode", mode),
  ]);
  throwResultErrors([
    provenanceResult,
    approvedFactsResult,
    commercialFactHistoryResult,
    intelligenceReviewEventsResult,
    contactsResult,
  ]);

  const contacts = contactsResult.data ?? [];
  const contactIds = contacts.map((contact) => contact.id);
  const [contactChangeProposalsResult, contactVerificationEventsResult] =
    contactIds.length
      ? await Promise.all([
          supabase
            .from("contact_change_proposals")
            .select("*")
            .in("contact_id", contactIds)
            .order("proposed_at", { ascending: false }),
          supabase
            .from("contact_verification_events")
            .select("*")
            .in("contact_id", contactIds)
            .order("occurred_at", { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (contactChangeProposalsResult.error)
    throw new Error(contactChangeProposalsResult.error.message);
  if (contactVerificationEventsResult.error)
    throw new Error(contactVerificationEventsResult.error.message);

  return {
    provenance: provenanceResult.data ?? [],
    researchJobs: summarizeResearchMemory(researchMemory),
    intelligenceClaims: researchMemory.claims,
    approvedFacts: (approvedFactsResult.data ?? []) as CommercialFact[],
    commercialFactHistory: commercialFactHistoryResult.data ?? [],
    intelligenceReviewEvents: intelligenceReviewEventsResult.data ?? [],
    contacts,
    contactChangeProposals: contactChangeProposalsResult.data ?? [],
    contactVerificationEvents: contactVerificationEventsResult.data ?? [],
  };
}

export type OverviewTabData = Awaited<ReturnType<typeof loadOverviewTab>>;
export type PeopleTabData = Awaited<ReturnType<typeof loadPeopleTab>>;
export type IntelligenceTabData = Awaited<ReturnType<typeof loadIntelligenceTab>>;
export type CommercialTabData = Awaited<ReturnType<typeof loadCommercialTab>>;
export type EvidenceTabData = Awaited<ReturnType<typeof loadEvidenceTab>>;

export async function loadProviderWorkspaceTabData(
  supabase: SupabaseClient,
  providerId: string,
  tab: ProviderWorkspaceTab,
  requestedFacilityId: string | null,
) {
  switch (tab) {
    case "overview":
      return {
        tab,
        tabData: await loadOverviewTab(
          supabase,
          providerId,
          requestedFacilityId,
        ),
      };
    case "people":
      return {
        tab,
        tabData: await loadPeopleTab(
          supabase,
          providerId,
          requestedFacilityId,
        ),
      };
    case "intelligence":
      return {
        tab,
        tabData: await loadIntelligenceTab(supabase, providerId),
      };
    case "commercial":
      return {
        tab,
        tabData: await loadCommercialTab(supabase, providerId),
      };
    case "evidence":
      return {
        tab,
        tabData: await loadEvidenceTab(supabase, providerId),
      };
  }
}
