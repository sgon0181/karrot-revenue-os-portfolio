export const DATA_HEALTH_PAGE_SIZE = 25;

export type DataHealthPageKey = "runsPage" | "issuesPage" | "queuePage" | "historyPage";

export type DataHealthSearchParams = Partial<Record<DataHealthPageKey | "notice", string | string[]>>;

export function pageNumber(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function pageRange(page: number, pageSize = DATA_HEALTH_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(total: number, pageSize = DATA_HEALTH_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginationHref(params: DataHealthSearchParams, key: DataHealthPageKey, page: number) {
  const next = new URLSearchParams();
  for (const [paramKey, rawValue] of Object.entries(params)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value && paramKey !== "notice") next.set(paramKey, value);
  }
  if (page <= 1) next.delete(key);
  else next.set(key, String(page));
  const query = next.toString();
  return query ? `/data-health?${query}` : "/data-health";
}
