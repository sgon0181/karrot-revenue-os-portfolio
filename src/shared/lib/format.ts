const SYDNEY_TIME_ZONE = "Australia/Sydney";

export function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-AU").format(Number(value));
}

export function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "Not recorded";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function sydneyOffsetMinutes(timestamp: number) {
  const zoneName = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TIME_ZONE,
    hour: "2-digit",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(timestamp))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = zoneName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Unable to resolve the Sydney timezone offset.");
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "+" ? minutes : -minutes;
}

export function sydneyLocalDateTimeToIso(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Enter a valid Sydney date and time.");

  const [, year, month, day, hour, minute, second = "0"] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let offset = sydneyOffsetMinutes(wallClockUtc);
  let timestamp = wallClockUtc - offset * 60_000;
  const correctedOffset = sydneyOffsetMinutes(timestamp);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    timestamp = wallClockUtc - offset * 60_000;
  }
  return new Date(timestamp).toISOString();
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
