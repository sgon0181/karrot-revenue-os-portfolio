import { ProviderWorkspace } from "@/features/accounts/components/provider-workspace";
import type { ProviderWorkspaceFacilityQuery } from "@/features/accounts/lib/provider-workspace-tabs";

export const maxDuration = 120;

export default function ProviderDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notice?: string;
    alert?: string;
    commercial_alert?: string;
    facility?: ProviderWorkspaceFacilityQuery;
    tab?: string;
    returnTo?: string | string[];
  }>;
}) {
  return <ProviderWorkspace {...props} />;
}
