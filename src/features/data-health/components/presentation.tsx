import {
  CheckCircle2,
  Clock3,
  FileClock,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react";

export type StatusTone = "green" | "amber" | "red" | "blue" | "slate";

const statusToneClasses: Record<StatusTone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusPill({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: StatusTone;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${statusToneClasses[tone]}`}>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {label}
    </span>
  );
}

export function importStatus(status: string | null | undefined, openIssues = 0, openErrors = 0) {
  if (status === "failed") return { label: "Import failed", tone: "red" as const, icon: XCircle };
  if (status === "running") return { label: "Import running", tone: "blue" as const, icon: Clock3 };
  if (!status) return { label: "Not imported", tone: "slate" as const, icon: FileClock };
  if (openErrors > 0) return { label: "Errors open", tone: "red" as const, icon: ShieldAlert };
  if (openIssues > 0) return { label: "Review required", tone: "amber" as const, icon: TriangleAlert };
  return { label: "Healthy", tone: "green" as const, icon: CheckCircle2 };
}

export function runStatus(status: string) {
  if (status === "succeeded") return { label: "Succeeded", tone: "green" as const, icon: CheckCircle2 };
  if (status === "failed") return { label: "Failed", tone: "red" as const, icon: XCircle };
  return { label: "Running", tone: "blue" as const, icon: Clock3 };
}

export function issueStatus(status: string, severity: string) {
  if (status === "resolved") return { label: "Resolved", tone: "green" as const };
  if (status === "ignored") return { label: "Ignored", tone: "slate" as const };
  if (severity === "error") return { label: "Open error", tone: "red" as const };
  if (severity === "warning") return { label: "Open warning", tone: "amber" as const };
  return { label: "Open information", tone: "blue" as const };
}

function rawText(rawData: unknown, keys: string[]) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return null;
  const row = rawData as Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function observedMatchIdentity(rawData: unknown) {
  const name = rawText(rawData, [
    "Service Name",
    "Aged Care Service Name",
    "Residential Care Home Name",
    "Name Of Each Home",
  ]);
  const provider = rawText(rawData, ["Provider Name", "Approved Provider Name", "Business Name"]);
  const suburb = rawText(rawData, ["Suburb", "Residential Care Home Suburb"]);
  return {
    name: name ?? "Observed name not available",
    context: [provider, suburb].filter(Boolean).join(" · ") || "Provider and location not available",
  };
}

export function candidateSummary(candidates: unknown) {
  if (!Array.isArray(candidates) || candidates.length === 0) return "No deterministic candidate";
  return candidates
    .slice(0, 3)
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
      const value = candidate as Record<string, unknown>;
      const name = typeof value.facility_name === "string" ? value.facility_name : "Unnamed facility";
      const siteId = typeof value.site_id === "string" ? value.site_id : null;
      return siteId ? `${name} (${siteId})` : name;
    })
    .filter(Boolean)
    .join("; ");
}

export function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: StatusTone;
}) {
  const iconTones: Record<StatusTone, string> = {
    green: "bg-[#e7faf2] text-[#134b35]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <article className="rounded-lg border border-[#dce7e1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(19,75,53,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950">{value}</p>
        </div>
        <span className={`grid size-8 shrink-0 place-items-center rounded-md ${iconTones[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-xs leading-4 text-slate-500">{detail}</p>
    </article>
  );
}

export function PanelHeader({
  id,
  title,
  description,
  icon: Icon,
  aside,
}: {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-[#cfe7dc] bg-[#e7faf2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white/80 text-[#18523b] ring-1 ring-[#c7e2d5]">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div>
          <h2 id={id} className="text-sm font-semibold text-[#173f30]">{title}</h2>
          <p className="mt-0.5 text-xs leading-4 text-[#4e6d61]">{description}</p>
        </div>
      </div>
      {aside}
    </header>
  );
}
