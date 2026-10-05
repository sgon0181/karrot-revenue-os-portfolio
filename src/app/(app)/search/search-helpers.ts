export type SearchResultTarget = {
  object_type: string | null;
  object_id: string | null;
  provider_id: string | null;
};

export function normaliseSearchQuery(query: string) {
  return query.replace(/[%_*,()]/g, " ").replace(/\s+/g, " ").trim();
}

export function searchPattern(query: string) {
  const normalised = normaliseSearchQuery(query);
  return normalised ? `%${normalised.replace(/\s+/g, "%")}%` : null;
}

export function searchResultHref(result: SearchResultTarget) {
  if (!result.object_id || !result.provider_id) return "/search";
  if (result.object_type === "opportunity") return `/opportunities/${result.object_id}`;
  if (result.object_type === "facility") {
    return `/providers/${result.provider_id}?tab=overview&facility=${result.object_id}#facility-${result.object_id}`;
  }
  if (result.object_type === "contact") return `/providers/${result.provider_id}?tab=people#contact-${result.object_id}`;
  if (result.object_type === "customer") return `/providers/${result.provider_id}?tab=commercial#customer`;
  return `/providers/${result.provider_id}?tab=overview`;
}
