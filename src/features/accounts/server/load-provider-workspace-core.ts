import {
  normalizeProviderWorkspaceFacilityId,
  type ProviderWorkspaceFacilityQuery,
} from "@/features/accounts/lib/provider-workspace-tabs";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import type { createClient } from "@/infrastructure/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function loadProviderWorkspaceCore(
  supabase: SupabaseClient,
  providerId: string,
  requestedFacilityId?: ProviderWorkspaceFacilityQuery,
) {
  const principalPromise = getAuthenticatedPrincipal();
  const [providerResult, facilitiesResult, principal] = await Promise.all([
    supabase.from("providers").select("*").eq("id", providerId).maybeSingle(),
    supabase
      .from("v_facility_latest")
      .select("*")
      .eq("provider_id", providerId)
      .order("name"),
    principalPromise,
  ]);

  for (const result of [providerResult, facilitiesResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const provider = providerResult.data;
  if (!provider) return null;
  const accountMode = provider.is_sample ? "sandbox" : "real";
  const [
    contactCountResult,
    activeOpportunityResult,
    latestActivityResult,
    nextActionResult,
    customerResult,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("record_mode", accountMode),
    supabase
      .from("opportunities")
      .select("record_mode, pipeline_stages(name, outcome)")
      .eq("provider_id", providerId)
      .eq("record_mode", accountMode)
      .order("updated_at", { ascending: false }),
    supabase
      .from("activities")
      .select("subject, occurred_at, record_mode")
      .eq("provider_id", providerId)
      .eq("record_mode", accountMode)
      .order("occurred_at", { ascending: false })
      .limit(1),
    supabase
      .from("next_actions")
      .select("title, due_at, record_mode")
      .eq("provider_id", providerId)
      .eq("record_mode", accountMode)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(1),
    supabase
      .from("customer_relationships")
      .select("status, record_mode")
      .eq("provider_id", providerId)
      .eq("record_mode", accountMode)
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  for (const result of [
    contactCountResult,
    activeOpportunityResult,
    latestActivityResult,
    nextActionResult,
    customerResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const facilities = (facilitiesResult.data ?? []).filter(
    (facility): facility is typeof facility & { id: string; name: string } =>
      Boolean(facility.id && facility.name),
  );
  const normalizedRequestedFacilityId =
    normalizeProviderWorkspaceFacilityId(requestedFacilityId);
  const selectedFacility = normalizedRequestedFacilityId
    ? facilities.find(
        (facility) =>
          facility.id.toLowerCase() === normalizedRequestedFacilityId,
      ) ?? null
    : null;
  const selectedFacilityId = selectedFacility?.id ?? null;
  const activeOpportunities = (activeOpportunityResult.data ?? []).filter(
    (opportunity) => !opportunity.pipeline_stages?.outcome,
  );
  const customers = customerResult.data ?? [];

  return {
    provider,
    facilities,
    selectedFacility,
    selectedFacilityId,
    requestedFacilityMissing:
      requestedFacilityId !== undefined && !selectedFacility,
    canEdit: principal.role === "owner" || principal.role === "editor",
    header: {
      contactCount: contactCountResult.count ?? 0,
      activeOpportunityCount: activeOpportunities.length,
      primaryActiveStage:
        activeOpportunities[0]?.pipeline_stages?.name ?? null,
      latestActivity: latestActivityResult.data?.[0] ?? null,
      nextOpenAction: nextActionResult.data?.[0] ?? null,
      customer:
        customers[0] ?? null,
    },
  };
}

export type ProviderWorkspaceCore = NonNullable<
  Awaited<ReturnType<typeof loadProviderWorkspaceCore>>
>;
