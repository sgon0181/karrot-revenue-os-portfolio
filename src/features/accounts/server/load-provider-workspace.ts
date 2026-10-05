import {
  normalizeProviderWorkspaceFacilityId,
  type ProviderWorkspaceFacilityQuery,
  type ProviderWorkspaceTab,
} from "@/features/accounts/lib/provider-workspace-tabs";
import {
  loadCommercialTab,
  loadEvidenceTab,
  loadIntelligenceTab,
  loadOverviewTab,
  loadPeopleTab,
  loadProviderWorkspaceTabData,
  type CommercialTabData,
  type EvidenceTabData,
  type IntelligenceTabData,
  type OverviewTabData,
  type PeopleTabData,
} from "@/features/accounts/server/load-provider-tabs";
import {
  loadProviderWorkspaceCore,
  type ProviderWorkspaceCore,
} from "@/features/accounts/server/load-provider-workspace-core";
import { researchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import { createClient } from "@/infrastructure/supabase/server";

export type ProviderWorkspaceData = ProviderWorkspaceCore &
  (
    | { tab: "overview"; tabData: OverviewTabData }
    | { tab: "people"; tabData: PeopleTabData }
    | { tab: "intelligence"; tabData: IntelligenceTabData }
    | { tab: "commercial"; tabData: CommercialTabData }
    | { tab: "evidence"; tabData: EvidenceTabData }
  ) & {
    freshnessPolicy: ReturnType<typeof researchFreshnessPolicy>;
  };

export const providerWorkspaceTabLoaders = {
  overview: loadOverviewTab,
  people: loadPeopleTab,
  intelligence: loadIntelligenceTab,
  commercial: loadCommercialTab,
  evidence: loadEvidenceTab,
} as const;

export async function loadProviderWorkspace(
  providerId: string,
  tab: ProviderWorkspaceTab,
  requestedFacilityId?: ProviderWorkspaceFacilityQuery,
): Promise<ProviderWorkspaceData | null> {
  const supabase = await createClient();
  const normalizedRequestedFacilityId =
    normalizeProviderWorkspaceFacilityId(requestedFacilityId);
  const core = await loadProviderWorkspaceCore(
    supabase,
    providerId,
    requestedFacilityId,
  );
  if (!core) return null;
  const selectedTab = await loadProviderWorkspaceTabData(
    supabase,
    providerId,
    tab,
    normalizedRequestedFacilityId,
  );
  const freshnessPolicy = researchFreshnessPolicy();
  return { ...core, ...selectedTab, freshnessPolicy };
}
