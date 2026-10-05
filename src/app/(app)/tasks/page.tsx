import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { SuccessToast } from "@/shared/components/success-toast";
import { Badge, SectionTitle } from "@/shared/components/ui";
import { CommercialEmptyState } from "@/features/commercial/components/commercial-empty-state";
import { TaskRow } from "@/features/commercial/components/task-row";
import { TaskCompletionBoundary } from "@/features/commercial/components/task-completion-boundary";
import { classifyDueDate } from "@/features/commercial/lib/commercial";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";
import { loadSampleProviderIds, recordBelongsToVisibleAccount } from "@/features/accounts/server/provider-record-mode";

type TaskFilter = "open" | "mine" | "today" | "overdue" | "upcoming" | "completed";

const filters: Array<{ value: TaskFilter; label: string }> = [
  { value: "open", label: "All open" },
  { value: "mine", label: "Mine" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; notice?: string }>;
}) {
  const { filter: requestedFilter, notice } = await searchParams;
  const filter = filters.some((item) => item.value === requestedFilter) ? requestedFilter as TaskFilter : "open";
  const supabase = await createClient();
  const [principal, tasksResult, sampleProviderIds] = await Promise.all([
    getAuthenticatedPrincipal(),
    supabase
      .from("next_actions")
      .select("*, providers(business_name), opportunities(name, pipeline_stages(name)), contacts(full_name)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    loadSampleProviderIds(supabase),
  ]);
  if (tasksResult.error) throw new Error(tasksResult.error.message);
  const canEdit = principal.role === "owner" || principal.role === "editor";
  const allTasks = (tasksResult.data ?? []).filter((task) =>
    recordBelongsToVisibleAccount(task.record_mode, task.provider_id, sampleProviderIds));
  const visibleTasks = allTasks.filter((task) => {
    if (filter === "completed") return task.status === "completed";
    if (task.status !== "open") return false;
    if (filter === "mine") return task.assigned_to === principal.id;
    if (filter === "today") return classifyDueDate(task.due_at) === "today";
    if (filter === "overdue") return classifyDueDate(task.due_at) === "overdue";
    if (filter === "upcoming") return classifyDueDate(task.due_at) === "upcoming";
    return true;
  });
  const sections = filter === "completed"
    ? [{ key: "completed", title: "Completed", description: "Recently completed actions", items: visibleTasks }]
    : [
        { key: "overdue", title: "Overdue", description: "Past the recorded due date", items: visibleTasks.filter((task) => classifyDueDate(task.due_at) === "overdue") },
        { key: "today", title: "Today", description: "Due today in Sydney", items: visibleTasks.filter((task) => classifyDueDate(task.due_at) === "today") },
        { key: "upcoming", title: "Upcoming", description: "Scheduled after today", items: visibleTasks.filter((task) => classifyDueDate(task.due_at) === "upcoming") },
        { key: "unscheduled", title: "Unscheduled", description: "Open actions without a due date", items: visibleTasks.filter((task) => classifyDueDate(task.due_at) === "unscheduled") },
      ];
  const emptyState = allTasks.length === 0
    ? {
        title: "No commercial tasks yet",
        description: canEdit
          ? "Tasks are next actions recorded against a provider or opportunity. Choose a provider to set the first clearly owned next step."
          : "No next actions have been recorded. You can browse providers while an editor or owner creates the commercial queue.",
        href: "/providers",
        actionLabel: "Browse providers",
      }
    : filter === "open"
      ? {
          title: "No open tasks",
          description: "Every recorded next action is complete. Review completed work or choose a provider to set another next step.",
          href: "/tasks?filter=completed",
          actionLabel: "View completed tasks",
        }
      : {
          title: `No ${filters.find((item) => item.value === filter)?.label.toLowerCase() ?? "matching"} tasks`,
          description: "This filter has no matching actions. Return to the open queue to continue the day’s commercial work.",
          href: "/tasks?filter=open",
          actionLabel: "View all open tasks",
        };
  const origin = `/tasks?filter=${filter}`;

  return (
    <div>
      {notice ? <SuccessToast message={notice} /> : null}
      <PageHeader
        eyebrow="Daily operating queue"
        title="Tasks"
        description="Complete, reschedule and navigate every next action without losing its provider or opportunity context."
      />

      <TaskCompletionBoundary>
        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Task filters">
          {filters.map((item) => (
            <Link
              key={item.value}
              href={`/tasks?filter=${item.value}`}
              aria-current={filter === item.value ? "page" : undefined}
              className={filter === item.value ? "button-primary whitespace-nowrap" : "button-secondary whitespace-nowrap"}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {!canEdit ? (
          <div className="mb-4 rounded-[7px] border border-[#cfded7] bg-[#f7faf8] px-4 py-3 text-sm text-[#43574e]">
            <span className="font-semibold text-[#1f4f3a]">View-only access.</span> You can inspect tasks but cannot complete or reschedule them.
          </div>
        ) : null}

        <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {sections.map((section) => section.items.length ? (
            <section key={section.key} className="card overflow-hidden">
              <div className="panel-header">
                <SectionTitle title={section.title} description={section.description} />
                <Badge tone={section.key === "overdue" ? "red" : section.key === "today" ? "blue" : "slate"}>{section.items.length}</Badge>
              </div>
              <div className="divide-y divide-[#e7edea]">
                {section.items.map((task) => (
                  <TaskRow key={task.id} task={task} sectionKey={section.key} origin={origin} />
                ))}
              </div>
            </section>
          ) : null)}
        </fieldset>

        {!visibleTasks.length ? (
          <div className="card"><CommercialEmptyState {...emptyState} /></div>
        ) : null}
      </TaskCompletionBoundary>
    </div>
  );
}
