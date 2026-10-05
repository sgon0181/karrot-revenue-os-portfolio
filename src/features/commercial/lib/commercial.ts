const SYDNEY_TIME_ZONE = "Australia/Sydney";

export const INACTIVITY_THRESHOLD_DAYS = 7;

export type RecordMode = "real" | "sandbox";
export type StageOutcome = "won" | "lost" | null;

export function stageTransitionGuidance({
  selectedOutcome,
  currentOutcome,
  hasCustomer,
}: {
  selectedOutcome: StageOutcome;
  currentOutcome: StageOutcome;
  hasCustomer: boolean;
}) {
  if (selectedOutcome === "won") {
    return {
      requiresLossReason: false,
      tone: "won" as const,
      message: `Closed Won creates or reactivates this provider’s ${hasCustomer ? "existing" : "new"} customer relationship.`,
    };
  }
  if (selectedOutcome === "lost") {
    return {
      requiresLossReason: true,
      tone: "lost" as const,
      message: "Closed Lost ends this commercial motion. The reason remains visible while the opportunity is closed.",
    };
  }
  if (currentOutcome && hasCustomer) {
    return {
      requiresLossReason: false,
      tone: "reopen" as const,
      message: "Reopening this opportunity does not remove the provider’s customer relationship.",
    };
  }
  return { requiresLossReason: false, tone: "neutral" as const, message: null };
}

export function isSandbox(mode: string | null | undefined): mode is "sandbox" {
  return mode === "sandbox";
}

export function humanise(value: string | null | undefined, fallback = "Not recorded") {
  if (!value) return fallback;
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function sydneyDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function classifyDueDate(value: string | null | undefined, now = new Date()) {
  if (!value) return "unscheduled" as const;
  const dueKey = sydneyDateKey(value);
  const todayKey = sydneyDateKey(now);
  if (dueKey < todayKey) return "overdue" as const;
  if (dueKey === todayKey) return "today" as const;
  return "upcoming" as const;
}

export function sydneyDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function opportunityHref(id: string | null | undefined, providerId: string) {
  return id ? `/opportunities/${id}` : `/providers/${providerId}?tab=commercial`;
}
