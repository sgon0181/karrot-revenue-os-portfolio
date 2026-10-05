import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarClock,
  Clock3,
  ListChecks,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState, SectionTitle } from "@/shared/components/ui";
import { CommercialEmptyState } from "@/features/commercial/components/commercial-empty-state";
import { classifyDueDate, INACTIVITY_THRESHOLD_DAYS, opportunityHref } from "@/features/commercial/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/shared/lib/format";
import { createClient } from "@/infrastructure/supabase/server";
import { withReturnTo } from "@/shared/lib/internal-navigation";

function sydneyHeading() {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function Metric({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="group border-b border-r border-[#dce6e1] bg-white p-4 transition-colors last:border-r-0 hover:bg-[#f7faf8] sm:p-5">
      <p className="text-xs font-semibold text-[#64726c]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#183128]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#64726c] group-hover:text-[#1f6548] group-hover:underline">{detail}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [metricsResult, stagesResult, pipelineResult, tasksResult, customersResult] = await Promise.all([
    supabase.from("v_dashboard_metrics").select("*").single(),
    supabase.from("v_opportunities_by_stage").select("*").order("position"),
    supabase.from("v_pipeline_board").select("*").order("next_action_due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("next_actions")
      .select("*, providers(business_name), opportunities(name, pipeline_stages(name))")
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("v_customer_overview").select("*").eq("status", "active"),
  ]);
  for (const result of [metricsResult, stagesResult, pipelineResult, tasksResult, customersResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const metrics = metricsResult.data;
  if (!metrics) throw new Error("Dashboard metrics are unavailable.");
  const stages = stagesResult.data ?? [];
  const pipeline = pipelineResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const customers = customersResult.data ?? [];
  const realTasks = tasks.filter((task) => task.record_mode === "real");
  const realPipeline = pipeline.filter((opportunity) => opportunity.record_mode === "real");
  const realCustomers = customers.filter((customer) => customer.record_mode === "real");
  const todayTasks = realTasks.filter((task) => classifyDueDate(task.due_at) === "today");
  const overdueTasks = realTasks.filter((task) => classifyDueDate(task.due_at) === "overdue");
  const upcomingTasks = realTasks.filter((task) => classifyDueDate(task.due_at) === "upcoming");
  const missingActions = realPipeline.filter((opportunity) => !opportunity.next_action);
  const inactiveOpportunities = realPipeline.filter((opportunity) =>
    opportunity.days_since_last_activity !== null
      ? Number(opportunity.days_since_last_activity) >= INACTIVITY_THRESHOLD_DAYS
      : Number(opportunity.days_in_stage) >= INACTIVITY_THRESHOLD_DAYS,
  );
  const onboardingAttention = realCustomers.filter((customer) => {
    const state = customer.onboarding_state?.toLowerCase();
    return Boolean(state && !["live", "complete", "completed"].includes(state));
  });
  const maxStage = Math.max(1, ...stages.map((stage) => Number(stage.opportunity_count)));

  return (
    <div>
      <PageHeader
        eyebrow="Commercial command centre"
        title={sydneyHeading()}
        description="Start with what needs attention, then move directly into the account or opportunity."
      />

      <section className="card overflow-hidden" aria-labelledby="attention-heading">
        <div className="border-b border-[#dce6e1] bg-[#143f30] px-4 py-4 text-white sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9dd4bb]">Needs your attention</p>
          <h2 id="attention-heading" className="mt-1 text-lg font-semibold">What moves revenue forward today?</h2>
        </div>
        <div className="grid gap-px bg-[#dce6e1] sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/tasks?filter=today" className="group bg-white p-4 hover:bg-[#f7faf8] sm:p-5"><p className="text-2xl font-semibold text-[#183128]">{todayTasks.length}</p><p className="mt-1 text-sm font-semibold text-[#385348]">actions due today</p><p className="mt-2 text-xs text-[#64726c] group-hover:underline">Open today’s queue</p></Link>
          <Link href="/pipeline" className="group bg-white p-4 hover:bg-[#f7faf8] sm:p-5"><p className="text-2xl font-semibold text-[#183128]">{missingActions.length}</p><p className="mt-1 text-sm font-semibold text-[#385348]">opportunities without a next action</p><p className="mt-2 text-xs text-[#64726c] group-hover:underline">Fix the gap</p></Link>
          <Link href="/pipeline" className="group bg-white p-4 hover:bg-[#f7faf8] sm:p-5"><p className="text-2xl font-semibold text-[#183128]">{inactiveOpportunities.length}</p><p className="mt-1 text-sm font-semibold text-[#385348]">inactive opportunities</p><p className="mt-2 text-xs text-[#64726c] group-hover:underline">{INACTIVITY_THRESHOLD_DAYS}+ days without activity</p></Link>
          <Link href="/customers" className="group bg-white p-4 hover:bg-[#f7faf8] sm:p-5"><p className="text-2xl font-semibold text-[#183128]">{onboardingAttention.length}</p><p className="mt-1 text-sm font-semibold text-[#385348]">onboarding items need attention</p><p className="mt-2 text-xs text-[#64726c] group-hover:underline">Open customers</p></Link>
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="card overflow-hidden">
          <div className="panel-header"><SectionTitle title="Today" description="Actions due today in Sydney" action={<Link href="/tasks?filter=today" className="text-link">All tasks <ArrowRight className="size-3.5" /></Link>} /></div>
          {todayTasks.length ? <div className="divide-y divide-[#e7edea]">{todayTasks.slice(0, 8).map((task) => (
            <Link key={task.id} href={withReturnTo(opportunityHref(task.opportunity_id, task.provider_id), "/dashboard")} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f7faf8] sm:px-5">
              <span className="icon-well"><ListChecks className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1f352c] group-hover:underline">{task.title}</p><p className="mt-1 truncate text-xs text-[#64726c]">{task.providers?.business_name}{task.opportunities?.name ? ` · ${task.opportunities.name}` : ""}</p></div>
              <p className="shrink-0 text-xs font-semibold text-[#385348]">{formatDate(task.due_at, true)}</p>
            </Link>
          ))}</div> : <CommercialEmptyState title="Nothing due today" description="Tasks are next actions recorded against a provider or opportunity. Choose a provider to set the next commercial step." href="/providers" actionLabel="Browse providers" />}
          {upcomingTasks.length ? <div className="border-t border-[#dce6e1]">
            <div className="flex items-center justify-between bg-[#f7faf8] px-4 py-2.5 sm:px-5"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64726c]">Next up</p><Link href="/tasks?filter=upcoming" className="text-link">Upcoming <ArrowRight className="size-3.5" /></Link></div>
            <div className="divide-y divide-[#e7edea]">{upcomingTasks.slice(0, 3).map((task) => (
              <Link key={`upcoming-${task.id}`} href={withReturnTo(opportunityHref(task.opportunity_id, task.provider_id), "/dashboard")} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[#f7faf8] sm:px-5">
                <span className="icon-well"><CalendarClock className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1f352c] group-hover:underline">{task.title}</p><p className="mt-1 truncate text-xs text-[#64726c]">{task.providers?.business_name}{task.opportunities?.name ? ` · ${task.opportunities.name}` : ""}</p></div>
                <p className="shrink-0 text-xs font-semibold text-[#385348]">{formatDate(task.due_at, true)}</p>
              </Link>
            ))}</div>
          </div> : null}
        </section>

        <section className="card overflow-hidden">
          <div className="panel-header"><SectionTitle title="Needs intervention" description="Overdue, inactive or missing next steps" /></div>
          {(overdueTasks.length || missingActions.length || inactiveOpportunities.length) ? <div className="divide-y divide-[#e7edea]">
            {overdueTasks.slice(0, 3).map((task) => <Link key={`task-${task.id}`} href={withReturnTo(opportunityHref(task.opportunity_id, task.provider_id), "/dashboard")} className="flex items-start gap-3 px-4 py-3.5 hover:bg-rose-50/40 sm:px-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600"><TriangleAlert className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#1f352c]">{task.providers?.business_name}</p><p className="mt-1 text-xs font-semibold text-rose-700">Overdue · {task.title}</p></div><ArrowRight className="mt-2 size-4 shrink-0 text-[#64726c]" /></Link>)}
            {missingActions.slice(0, 3).map((opportunity) => <Link key={`missing-${opportunity.id}`} href={withReturnTo(`/opportunities/${opportunity.id}`, "/dashboard")} className="flex items-start gap-3 px-4 py-3.5 hover:bg-amber-50/40 sm:px-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700"><Clock3 className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#1f352c]">{opportunity.provider_name}</p><p className="mt-1 text-xs text-amber-800">{opportunity.stage_name} · No next action scheduled</p></div><ArrowRight className="mt-2 size-4 shrink-0 text-[#64726c]" /></Link>)}
            {inactiveOpportunities.filter((item) => !missingActions.some((missing) => missing.id === item.id)).slice(0, 3).map((opportunity) => <Link key={`inactive-${opportunity.id}`} href={withReturnTo(`/opportunities/${opportunity.id}`, "/dashboard")} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#f7faf8] sm:px-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#eef3f0] text-[#52635b]"><CalendarClock className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#1f352c]">{opportunity.provider_name}</p><p className="mt-1 text-xs text-[#64726c]">{opportunity.days_since_last_activity ?? opportunity.days_in_stage} days without activity</p></div><ArrowRight className="mt-2 size-4 shrink-0 text-[#64726c]" /></Link>)}
          </div> : <EmptyState title="No intervention required" description="Overdue, inactive and no-next-action opportunities will surface here." />}
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="panel-header"><SectionTitle title="Commercial overview" description="Recorded commercial performance" /></div>
        <div className="grid gap-px bg-[#dce6e1] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric label="Active opportunities" value={formatNumber(metrics.active_opportunities)} detail="Open the pipeline" href="/pipeline" />
          <Metric label="Customers" value={formatNumber(metrics.active_customers)} detail="Open active relationships" href="/customers" />
          <Metric label="Facilities live" value={formatNumber(metrics.facilities_live)} detail="Review customer deployment" href="/customers" />
          <Metric label="Beds live" value={formatNumber(metrics.beds_live)} detail="Review recorded deployment" href="/customers" />
          <Metric label="MRR" value={formatCurrency(metrics.mrr)} detail="Review known recurring revenue" href="/customers" />
          <Metric label="ARR" value={formatCurrency(metrics.arr)} detail="Review known recurring revenue" href="/customers" />
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="card overflow-hidden">
          <div className="panel-header"><SectionTitle title="Pipeline distribution" description="Opportunities by configured stage" action={<Link href="/pipeline" className="text-link">Open board <ArrowRight className="size-3.5" /></Link>} /></div>
          {stages.some((stage) => Number(stage.opportunity_count) > 0) ? <div className="space-y-3 p-4 sm:p-5">{stages.map((stage) => {
            const count = Number(stage.opportunity_count);
            return <div key={stage.stage_id} className="grid grid-cols-[110px_1fr_30px] items-center gap-3 text-xs"><span className="truncate font-semibold text-[#52635b]">{stage.name}</span><div className="h-2 rounded-full bg-[#eef3f0]"><div className="h-2 rounded-full" style={{ width: `${(count / maxStage) * 100}%`, backgroundColor: stage.color ?? "#14ae5c" }} /></div><span className="text-right font-semibold">{count}</span></div>;
          })}</div> : <CommercialEmptyState title="No opportunities yet" description="Choose a provider to create the first commercial motion." href="/providers" actionLabel="Browse providers" />}
        </section>

        <section className="card overflow-hidden">
          <div className="panel-header"><SectionTitle title="Market coverage" description="Government-backed NSW market context" action={<Link href="/providers" className="text-link">Providers <ArrowRight className="size-3.5" /></Link>} /></div>
          <div className="grid grid-cols-2 gap-px bg-[#dce6e1]">
            <div className="bg-white p-5"><span className="icon-well"><Building2 className="size-4" /></span><p className="mt-3 text-2xl font-semibold text-[#183128]">{formatNumber(metrics.nsw_providers)}</p><p className="mt-1 text-xs text-[#64726c]">NSW providers</p></div>
            <div className="bg-white p-5"><span className="icon-well"><BedDouble className="size-4" /></span><p className="mt-3 text-2xl font-semibold text-[#183128]">{formatNumber(metrics.nsw_facilities)}</p><p className="mt-1 text-xs text-[#64726c]">NSW facilities</p></div>
          </div>
          <div className="border-t border-[#e7edea] p-4"><Link href="/data-health" className="text-link">Review source health <ArrowRight className="size-3.5" /></Link></div>
        </section>
      </div>
    </div>
  );
}
