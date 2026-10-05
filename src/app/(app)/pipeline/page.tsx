import {
  AlertTriangle,
  CircleDollarSign,
  UserRoundX,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { SuccessToast } from "@/shared/components/success-toast";
import { formatCurrency, formatNumber } from "@/shared/lib/format";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";
import { CommercialErrorToast } from "@/features/commercial/components/commercial-error-toast";
import { PipelineBoard } from "@/features/commercial/components/pipeline-board";
import { loadSampleProviderIds, recordBelongsToVisibleAccount } from "@/features/accounts/server/provider-record-mode";

function SummaryCard({
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
  tone?: "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    green: "bg-[#e7faf2] text-[#134b35]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
  };

  return (
    <article className="rounded-lg border border-[#dce7e1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(19,75,53,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950">{value}</p>
        </div>
        <span className={`grid size-8 shrink-0 place-items-center rounded-md ${tones[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-xs leading-4 text-slate-500">{detail}</p>
    </article>
  );
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ notice?: string; alert?: string }> }) {
  const { notice, alert } = await searchParams;
  const supabase = await createClient();
  const [principal, stagesResult, opportunitiesResult, sampleProviderIds] = await Promise.all([
    getAuthenticatedPrincipal(),
    supabase.from("pipeline_stages").select("*").eq("is_active", true).order("position"),
    supabase.from("v_pipeline_board").select("*").order("stage_position").order("updated_at", { ascending: false }),
    loadSampleProviderIds(supabase),
  ]);
  const canEdit = principal.role === "owner" || principal.role === "editor";
  if (stagesResult.error) throw new Error(stagesResult.error.message);
  if (opportunitiesResult.error) throw new Error(opportunitiesResult.error.message);
  const stages = stagesResult.data ?? [];
  const boardStages = stages.filter((stage) => !stage.outcome);
  const opportunities = (opportunitiesResult.data ?? []).filter(
    (opportunity): opportunity is typeof opportunity & { id: string; provider_id: string; stage_id: string } =>
      Boolean(opportunity.id && opportunity.provider_id && opportunity.stage_id)
        && recordBelongsToVisibleAccount(opportunity.record_mode, opportunity.provider_id, sampleProviderIds),
  );
  const overdueCount = opportunities.filter((opportunity) => opportunity.next_action_overdue).length;
  const missingActionCount = opportunities.filter((opportunity) => !opportunity.next_action).length;
  const recordedValues = opportunities.filter((opportunity) => opportunity.estimated_value !== null);
  const recordedPipelineValue = recordedValues.reduce(
    (total, opportunity) => total + Number(opportunity.estimated_value ?? 0),
    0,
  );

  return (
    <div>
      {notice ? <SuccessToast message={notice} /> : null}
      {alert ? <CommercialErrorToast message={alert} /> : null}
      {!canEdit ? (
        <div role="status" className="mb-4 rounded-[7px] border border-[#cfded7] bg-[#f7faf8] px-4 py-3 text-sm text-[#43574e]">
          <span className="font-semibold text-[#1f4f3a]">View-only access.</span> Stage controls are disabled for your workspace role.
        </div>
      ) : null}
      <PageHeader
        eyebrow="Commercial motion"
        title="Pipeline"
        description="Active opportunities grouped by their configured stage. Time in stage, activity recency, and next-action urgency are shown exactly as recorded."
      />

      <section aria-label="Pipeline summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active opportunities"
          value={formatNumber(opportunities.length)}
          detail={`${formatNumber(boardStages.length)} active stages · no inferred probabilities`}
          icon={Workflow}
        />
        <SummaryCard
          label="Recorded pipeline value"
          value={recordedValues.length ? formatCurrency(recordedPipelineValue) : "Not recorded"}
          detail={`${formatNumber(recordedValues.length)} of ${formatNumber(opportunities.length)} active ${opportunities.length === 1 ? "opportunity has" : "opportunities have"} a value`}
          icon={CircleDollarSign}
          tone="blue"
        />
        <SummaryCard
          label="Overdue actions"
          value={formatNumber(overdueCount)}
          detail={overdueCount ? "Past their recorded due date" : "No recorded actions are overdue"}
          icon={AlertTriangle}
          tone={overdueCount ? "red" : "green"}
        />
        <SummaryCard
          label="Next action missing"
          value={formatNumber(missingActionCount)}
          detail="Active opportunities without a recorded next step"
          icon={UserRoundX}
          tone={missingActionCount ? "amber" : "green"}
        />
      </section>

      <PipelineBoard stages={boardStages} opportunities={opportunities} canEdit={canEdit} />
    </div>
  );
}
