import type { AccountActionClient } from "@/features/accounts/server/actions/context";
import {
  mutationReturnOpportunityId,
  safeInternalPath,
  validatedSingleInternalPath,
} from "@/shared/lib/internal-navigation";

export function validatedFormReturnTo(formData: FormData) {
  return validatedSingleInternalPath(formData.getAll("return_to"));
}

export async function verifiedMutationReturnOpportunityId(
  supabase: AccountActionClient,
  formData: FormData,
  providerId: string,
  alreadyVerifiedOpportunityId: string | null,
) {
  const requestedOpportunityId = mutationReturnOpportunityId(formData);
  if (!requestedOpportunityId) return null;
  if (requestedOpportunityId === alreadyVerifiedOpportunityId) {
    return requestedOpportunityId;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select("id")
    .eq("id", requestedOpportunityId)
    .eq("provider_id", providerId)
    .maybeSingle();
  return error ? null : data?.id ?? null;
}

export function commercialMessagePath(
  destination: string,
  kind: "notice" | "alert",
  message: string,
) {
  const url = new URL(safeInternalPath(destination), "http://karrot.local");
  url.searchParams.set(kind, message);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function commercialAlertPath(destination: string, message: string) {
  const safeDestination = safeInternalPath(destination);
  if (safeDestination.startsWith("/providers/")) {
    const url = new URL(safeDestination, "http://karrot.local");
    url.searchParams.set("commercial_alert", message);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return commercialMessagePath(safeDestination, "alert", message);
}

export function accountWorkspaceTab(value: string | null) {
  return ["overview", "people", "intelligence", "commercial", "evidence"].includes(value ?? "")
    ? value!
    : "intelligence";
}

export function researchPath({
  providerId,
  facilityId,
  tab = "intelligence",
  notice,
  alert,
}: {
  providerId: string;
  facilityId: string | null;
  tab?: string;
  notice?: string;
  alert?: string;
}) {
  const query = new URLSearchParams();
  const destinationTab = accountWorkspaceTab(tab);
  query.set("tab", destinationTab);
  if (facilityId) query.set("facility", facilityId);
  if (notice) query.set("notice", notice);
  if (alert) query.set("alert", alert);
  const anchor = destinationTab === "intelligence"
    ? "account-intelligence"
    : destinationTab === "people"
      ? "contacts"
      : null;
  return `/providers/${providerId}?${query.toString()}${anchor ? `#${anchor}` : ""}`;
}
