"use client";

import Link from "next/link";
import { useActionState, useLayoutEffect, useOptimistic, useRef } from "react";
import { CalendarClock, Check, Clock3, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { Database } from "@/infrastructure/supabase/database.types";
import { rescheduleNextAction } from "@/features/accounts/server/actions";
import { completeNextActionInline } from "@/features/commercial/server/inline-actions";
import { useTaskCompletionFeedback } from "@/features/commercial/components/task-completion-boundary";
import {
  completeTaskOptimistically,
  initialInlineActionState,
  type InlineActionState,
} from "@/features/commercial/lib/optimistic-interactions";
import { opportunityHref, sydneyDateTimeLocalValue } from "@/features/commercial/lib/commercial";
import { DisclosureForm, Field } from "@/shared/components/forms";
import { InternalReturnToInput } from "@/shared/components/internal-return-to-input";
import { SubmitButton } from "@/shared/components/submit-button";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";
import { withReturnTo } from "@/shared/lib/internal-navigation";

type NextAction = Database["public"]["Tables"]["next_actions"]["Row"];

export type TaskListItem = NextAction & {
  providers: { business_name: string } | null;
  opportunities: {
    name: string;
    pipeline_stages: { name: string } | null;
  } | null;
};

export function TaskRow({
  task,
  sectionKey,
  origin,
}: {
  task: TaskListItem;
  sectionKey: string;
  origin: string;
}) {
  const completeButtonRef = useRef<HTMLButtonElement>(null);
  const reportCompletionFeedback = useTaskCompletionFeedback();
  const [optimisticTask, completeOptimistically] = useOptimistic<TaskListItem, string>(
    task,
    completeTaskOptimistically,
  );
  const [state, formAction, pending] = useActionState(
    async (previousState: InlineActionState, formData: FormData) => {
      reportCompletionFeedback({ status: "pending", message: `Completing ${task.title}.` });
      completeOptimistically(task.id);
      const result = await completeNextActionInline(previousState, formData);
      reportCompletionFeedback(result);
      return result;
    },
    initialInlineActionState,
  );
  const destination = withReturnTo(
    opportunityHref(task.opportunity_id, task.provider_id),
    origin,
  );
  const isCompleted = optimisticTask.status === "completed";
  const isOverdue = sectionKey === "overdue" && !isCompleted;
  const showControls = !isCompleted || pending;

  useLayoutEffect(() => {
    if (!pending && state.status === "error") completeButtonRef.current?.focus();
  }, [pending, state.status]);

  return (
    <article
      aria-busy={pending}
      className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${isOverdue ? "bg-rose-50 text-rose-600" : isCompleted ? "bg-emerald-50 text-emerald-700" : "bg-[#e7faf2] text-[#1f6548]"}`}>
          {isOverdue ? <TriangleAlert className="size-4" aria-hidden /> : isCompleted ? <Check className="size-4" aria-hidden /> : <Clock3 className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={destination} className={`text-sm font-semibold text-[#1f352c] hover:text-[#1f6548] hover:underline ${isCompleted ? "line-through opacity-70" : ""}`}>{task.title}</Link>
            {task.priority === "high" ? <Badge tone="red">High priority</Badge> : null}
            {pending ? <Badge tone="green"><LoaderCircle className="size-3 animate-spin" aria-hidden /> Completing…</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-[#64726c]">
            <Link href={withReturnTo(`/providers/${task.provider_id}?tab=commercial`, origin)} className="font-semibold text-[#385348] hover:underline">{task.providers?.business_name}</Link>
            {task.opportunities?.name ? ` · ${task.opportunities.name}` : " · Provider-level"}
            {task.opportunities?.pipeline_stages?.name ? ` · ${task.opportunities.pipeline_stages.name}` : ""}
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${isOverdue ? "font-semibold text-[#c53141]" : "text-[#64726c]"}`}>
            <CalendarClock className="size-3.5" aria-hidden />{formatDate(task.due_at, true)}
          </p>
        </div>
      </div>
      {showControls ? (
        <div className="flex items-center gap-2 sm:justify-end">
          <form action={formAction} aria-busy={pending}>
            <input type="hidden" name="provider_id" value={task.provider_id} />
            <input type="hidden" name="action_id" value={task.id} />
            <button ref={completeButtonRef} className="button-primary" type="submit" disabled={pending} aria-busy={pending}>
              {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden /> Completing…</> : <><Check className="size-4" aria-hidden /> Complete</>}
            </button>
          </form>
          <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
            <DisclosureForm label="Reschedule">
              <form action={rescheduleNextAction} className="space-y-4">
                <input type="hidden" name="provider_id" value={task.provider_id} />
                <input type="hidden" name="opportunity_id" value={task.opportunity_id ?? ""} />
                <input type="hidden" name="action_id" value={task.id} />
                <InternalReturnToInput returnTo={origin} />
                <Field label="New due time (Sydney)" name="due_at" type="datetime-local" defaultValue={sydneyDateTimeLocalValue(task.due_at)} required />
                <SubmitButton pendingLabel="Rescheduling…"><RotateCcw className="size-4" /> Reschedule</SubmitButton>
              </form>
            </DisclosureForm>
          </fieldset>
        </div>
      ) : null}
    </article>
  );
}
