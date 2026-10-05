export function accountWorkspaceTab(value: string | null) {
  return ["overview", "people", "intelligence", "commercial", "evidence"].includes(
    value ?? "",
  )
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
  const anchor =
    destinationTab === "intelligence"
      ? "account-intelligence"
      : destinationTab === "people"
        ? "contacts"
        : null;
  return `/providers/${providerId}?${query.toString()}${anchor ? `#${anchor}` : ""}`;
}
