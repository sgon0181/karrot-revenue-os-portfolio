"use client";

import Link from "next/link";
import { useActionState, useLayoutEffect, useMemo, useOptimistic, useRef } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ContactRound,
  LoaderCircle,
  MoveRight,
  Workflow,
} from "lucide-react";
import type { Database } from "@/infrastructure/supabase/database.types";
import { moveOpportunityStageInline } from "@/features/commercial/server/inline-actions";
import {
  initialInlineActionState,
  moveOpportunityOptimistically,
  type InlineActionState,
  type OpportunityMove,
} from "@/features/commercial/lib/optimistic-interactions";
import { CommercialEmptyState } from "@/features/commercial/components/commercial-empty-state";
import { formatCurrency, formatDate, formatNumber } from "@/shared/lib/format";
import { withReturnTo } from "@/shared/lib/internal-navigation";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#134b35] focus-visible:ring-offset-2";

type PipelineStage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type PipelineBoardRow = Database["public"]["Views"]["v_pipeline_board"]["Row"];

export type ActivePipelineOpportunity = PipelineBoardRow & {
  id: string;
  provider_id: string;
  stage_id: string;
};

type MoveActionState = InlineActionState & {
  opportunityId: string | null;
};

type OptimisticPipelineState = {
  opportunities: ActivePipelineOpportunity[];
  activeMoveId: string | null;
};

const initialMoveActionState: MoveActionState = {
  ...initialInlineActionState,
  opportunityId: null,
};

function MoveControl({
  opportunity,
  stages,
  canEdit,
  action,
  disabled,
  pending,
  state,
}: {
  opportunity: ActivePipelineOpportunity;
  stages: PipelineStage[];
  canEdit: boolean;
  action: (formData: FormData) => void;
  disabled: boolean;
  pending: boolean;
  state: MoveActionState;
}) {
  const feedback = state.opportunityId === opportunity.id ? state : initialMoveActionState;

  return (
    <form action={action} aria-busy={pending} className="relative mt-3 border-t border-[#e6ece9] pt-3">
      <input type="hidden" name="opportunity_id" value={opportunity.id} />
      <input type="hidden" name="provider_id" value={opportunity.provider_id} />
      <input type="hidden" name="expected_stage_id" value={opportunity.stage_id} />
      <label className="sr-only" htmlFor={`stage-select-${opportunity.id}`}>
        Move {opportunity.provider_name} to stage
      </label>
      <div className="flex gap-1.5">
        <select
          id={`stage-select-${opportunity.id}`}
          className={`min-w-0 flex-1 rounded-md border border-[#cfdad5] bg-white px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:border-[#9eb9ac] disabled:cursor-wait disabled:opacity-65 ${focusRing}`}
          name="stage_id"
          defaultValue={opportunity.stage_id}
          disabled={disabled || !canEdit}
        >
          {stages.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={disabled || !canEdit}
          aria-busy={pending}
          className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-[#b9cfc4] bg-white px-2.5 text-xs font-semibold text-[#1d5b42] transition hover:border-[#35785d] hover:bg-[#eff9f4] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
        >
          {pending ? <><LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Moving…</> : <>Move <MoveRight className="size-3.5" aria-hidden /></>}
        </button>
      </div>
      {feedback.status !== "idle" ? (
        <p
          aria-live="polite"
          className={`mt-2 text-xs leading-4 ${feedback.status === "error" ? "font-medium text-rose-700" : "text-[#35785d]"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}

export function PipelineBoard({
  stages,
  opportunities,
  canEdit,
}: {
  stages: PipelineStage[];
  opportunities: ActivePipelineOpportunity[];
  canEdit: boolean;
}) {
  const authoritativePipeline = useMemo<OptimisticPipelineState>(() => ({
    opportunities,
    activeMoveId: null,
  }), [opportunities]);
  const [optimisticPipeline, moveOptimistically] = useOptimistic<
    OptimisticPipelineState,
    OpportunityMove
  >(
    authoritativePipeline,
    (current, move) => ({
      opportunities: moveOpportunityOptimistically(current.opportunities, move),
      activeMoveId: move.opportunityId,
    }),
  );
  const [moveState, moveAction, movePending] = useActionState(
    async (previousState: MoveActionState, formData: FormData): Promise<MoveActionState> => {
      const opportunityId = String(formData.get("opportunity_id") ?? "");
      const stageId = String(formData.get("stage_id") ?? "");
      if (opportunityId && stageId) {
        moveOptimistically({ opportunityId, stageId });
      }
      const result = await moveOpportunityStageInline(previousState, formData);
      return { ...result, opportunityId: opportunityId || null };
    },
    initialMoveActionState,
  );
  const { opportunities: optimisticOpportunities, activeMoveId } = optimisticPipeline;
  const focusOpportunityId = activeMoveId ?? (
    moveState.status === "idle" ? null : moveState.opportunityId
  );
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const didScrollToFirstPopulatedStage = useRef(false);
  const firstPopulatedStageId = useMemo(() => {
    const populatedStageIds = new Set(opportunities.map((opportunity) => opportunity.stage_id));
    return stages.find((stage) => populatedStageIds.has(stage.id))?.id ?? null;
  }, [opportunities, stages]);

  useLayoutEffect(() => {
    if (!firstPopulatedStageId || didScrollToFirstPopulatedStage.current) return;
    const frame = window.requestAnimationFrame(() => {
      const firstPopulatedColumn = boardViewportRef.current?.querySelector<HTMLElement>(
        "[data-pipeline-stage-populated='true']",
      );
      if (!firstPopulatedColumn) return;
      firstPopulatedColumn.scrollIntoView({ block: "nearest", inline: "start" });
      didScrollToFirstPopulatedStage.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [firstPopulatedStageId]);

  useLayoutEffect(() => {
    if (!focusOpportunityId) return;
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`opportunity-card-${focusOpportunityId}`);
      card?.scrollIntoView({ block: "nearest", inline: "nearest" });
      card?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOpportunityId, movePending, moveState.status]);

  const activeOpportunity = activeMoveId
    ? optimisticOpportunities.find((opportunity) => opportunity.id === activeMoveId)
    : null;

  return (
    <section
      aria-labelledby="pipeline-board-heading"
      className="overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {movePending && activeOpportunity
          ? `Moving ${activeOpportunity.name ?? "opportunity"}.`
          : moveState.status === "idle" ? "" : moveState.message}
      </p>
      <header className="flex flex-col gap-2 border-b border-[#cfe7dc] bg-[#e7faf2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="pipeline-board-heading" className="text-sm font-semibold text-[#173f30]">
            Opportunity board
          </h2>
          <p className="mt-0.5 text-xs text-[#4e6d61]">Move active work on the card. Close Won or Lost from the opportunity workspace so the consequence is explicit.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#bddbcc] bg-white/75 px-2.5 py-1 text-xs font-semibold text-[#245b45]">
          <CheckCircle2 className="size-3.5" aria-hidden />
          Database-backed stages
        </span>
      </header>

      {!optimisticOpportunities.length ? (
        <CommercialEmptyState
          title="No active opportunities yet"
          description={canEdit
            ? "Pipeline tracks active commercial motions through configured stages. Choose a provider and create an opportunity to begin."
            : "Pipeline tracks active commercial motions through configured stages. Browse providers while an editor or owner creates the first opportunity."}
          href="/providers"
          actionLabel="Browse providers"
        />
      ) : stages.length ? (
        <div
          ref={boardViewportRef}
          aria-label="Pipeline stages. Scroll horizontally to review every stage."
          className="flex min-h-[560px] snap-x snap-mandatory gap-3 overflow-x-auto bg-[#f3f6f4] p-3 pb-4 lg:snap-none"
          role="region"
          tabIndex={0}
        >
          {stages.map((stage) => {
            const cards = optimisticOpportunities.filter((opportunity) => opportunity.stage_id === stage.id);
            if (!cards.length) {
              return (
                <section
                  key={stage.id}
                  id={`stage-column-${stage.id}`}
                  aria-labelledby={`stage-${stage.id}`}
                  data-pipeline-stage-populated="false"
                  className="w-12 shrink-0 snap-start overflow-hidden rounded-lg border border-[#d9e3de] bg-[#f8faf9]"
                >
                  <header className="flex h-full min-h-[520px] flex-col items-center gap-3 border-b border-[#d8ebe2] bg-[#e7faf2] px-2 py-3">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3
                      id={`stage-${stage.id}`}
                      title={stage.name}
                      className="min-h-0 flex-1 truncate text-[12px] font-semibold text-[#173f30] [writing-mode:vertical-rl] rotate-180"
                    >
                      {stage.name}
                    </h3>
                    <span
                      aria-label="0 opportunities"
                      className="grid min-w-6 shrink-0 place-items-center rounded-md border border-[#c9dfd4] bg-white px-1.5 py-0.5 text-xs font-bold text-[#245b45]"
                    >
                      0
                    </span>
                  </header>
                </section>
              );
            }
            return (
              <section
                key={stage.id}
                id={`stage-column-${stage.id}`}
                aria-labelledby={`stage-${stage.id}`}
                data-pipeline-stage-populated="true"
                className="w-[min(88vw,300px)] shrink-0 snap-start overflow-hidden rounded-lg border border-[#d9e3de] bg-[#f8faf9] sm:w-[300px]"
              >
                <header className="flex items-center justify-between gap-3 border-b border-[#d8ebe2] bg-[#e7faf2] px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 id={`stage-${stage.id}`} className="truncate text-[13px] font-semibold text-[#173f30]">
                      {stage.name}
                    </h3>
                  </div>
                  <span
                    aria-label={`${cards.length} ${cards.length === 1 ? "opportunity" : "opportunities"}`}
                    className="grid min-w-6 shrink-0 place-items-center rounded-md border border-[#c9dfd4] bg-white px-1.5 py-0.5 text-xs font-bold text-[#245b45]"
                  >
                    {cards.length}
                  </span>
                </header>

                <div className="space-y-2.5 p-2.5">
                  {cards.map((opportunity) => (
                    <article
                      key={opportunity.id}
                      id={`opportunity-card-${opportunity.id}`}
                      tabIndex={-1}
                      className={`rounded-lg border border-[#dfe7e3] border-t-2 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,47,36,0.045)] transition-colors hover:border-[#bcd4c8] ${focusRing}`}
                      style={{ borderTopColor: stage.color }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={withReturnTo(`/opportunities/${opportunity.id}`, "/pipeline")}
                            className={`block truncate text-[13px] font-semibold text-slate-950 decoration-emerald-600 decoration-2 underline-offset-2 hover:text-[#0f6848] hover:underline ${focusRing}`}
                          >
                            {opportunity.name}
                          </Link>
                          <Link href={withReturnTo(`/providers/${opportunity.provider_id}?tab=commercial`, "/pipeline")} className="mt-1 block truncate text-xs text-slate-500 hover:text-[#0f6848] hover:underline">{opportunity.provider_name}</Link>
                        </div>
                        {opportunity.next_action_overdue ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-50 px-1.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                            <AlertTriangle className="size-3" aria-hidden /> Overdue
                          </span>
                        ) : null}
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                        <div className="rounded-md bg-[#f3f7f5] px-2.5 py-2">
                          <dt className="text-slate-500">In stage</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800">
                            {formatNumber(opportunity.days_in_stage)} {Number(opportunity.days_in_stage) === 1 ? "day" : "days"}
                          </dd>
                        </div>
                        <div className="rounded-md bg-[#f3f7f5] px-2.5 py-2">
                          <dt className="text-slate-500">Est. value</dt>
                          <dd className="mt-0.5 truncate font-semibold text-slate-800">{formatCurrency(opportunity.estimated_value)}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 space-y-2 text-xs leading-4 text-slate-600">
                        <p className="flex items-start gap-2">
                          <ContactRound className="mt-px size-3.5 shrink-0 text-[#35785d]" aria-hidden />
                          <span className="min-w-0 truncate">{opportunity.primary_contact_name ?? "No primary contact recorded"}</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <Clock3 className="mt-px size-3.5 shrink-0 text-[#35785d]" aria-hidden />
                          <span>
                            {opportunity.last_activity_at
                              ? `${formatNumber(opportunity.days_since_last_activity)} ${Number(opportunity.days_since_last_activity) === 1 ? "day" : "days"} since activity`
                              : "No activity recorded"}
                          </span>
                        </p>
                        <p className={`flex items-start gap-2 ${opportunity.next_action_overdue ? "font-medium text-rose-700" : "text-slate-600"}`}>
                          <CalendarDays className="mt-px size-3.5 shrink-0" aria-hidden />
                          <span>
                            {opportunity.next_action ?? "No next action recorded"}
                            {opportunity.next_action_due_at ? ` · ${formatDate(opportunity.next_action_due_at)}` : ""}
                          </span>
                        </p>
                        {opportunity.blockers ? <p className="mt-2 line-clamp-2 rounded-[5px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium leading-4 text-amber-800">Blocker: {opportunity.blockers}</p> : null}
                      </div>

                      <MoveControl
                        opportunity={opportunity}
                        stages={stages}
                        canEdit={canEdit}
                        action={moveAction}
                        disabled={movePending}
                        pending={movePending && activeMoveId === opportunity.id}
                        state={moveState}
                      />
                    </article>
                  ))}

                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
          <div>
            <Workflow className="mx-auto size-6 text-slate-600" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">No active pipeline stages</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">The board will appear when an active, non-terminal stage is configured.</p>
          </div>
        </div>
      )}
    </section>
  );
}
