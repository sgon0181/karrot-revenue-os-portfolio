import Link from "next/link";
import {
  ArrowUpRight,
  BedDouble,
  CalendarClock,
  CircleDollarSign,
  HousePlug,
  UsersRound,
} from "lucide-react";
import { CustomerIconWell } from "@/features/commercial/components/customer-icon-well";
import { CommercialEmptyState } from "@/features/commercial/components/commercial-empty-state";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/shared/lib/format";
import { createClient } from "@/infrastructure/supabase/server";
import { withReturnTo } from "@/shared/lib/internal-navigation";
import { loadSampleProviderIds, recordBelongsToVisibleAccount } from "@/features/accounts/server/provider-record-mode";

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article
      className="card min-w-0 rounded-[8px] p-3.5 sm:p-4"
      aria-label={`${label}: ${value}. ${detail}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CustomerIconWell icon={Icon} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800">{label}</p>
          <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
        </div>
      </div>
      <p className="mt-3 break-words text-xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-2xl">{value}</p>
    </article>
  );
}

function humaniseStatus(value: string | null) {
  if (!value) return "Not recorded";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function customerInitials(name: string | null) {
  return (name ?? "Unknown provider")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const [{ data, error }, sampleProviderIds] = await Promise.all([
    supabase
      .from("v_customer_overview")
      .select("*")
      .order("provider_name"),
    loadSampleProviderIds(supabase),
  ]);
  if (error) throw new Error(error.message);
  const customers = (data ?? []).filter((customer) =>
    recordBelongsToVisibleAccount(customer.record_mode, customer.provider_id, sampleProviderIds));
  const totals = customers.reduce(
    (result, customer) => ({
      active: result.active + (customer.status === "active" ? 1 : 0),
      liveFacilities: result.liveFacilities + Number(customer.facilities_live ?? 0),
      liveBeds: result.liveBeds + Number(customer.beds_live ?? 0),
      mrr: result.mrr + Number(customer.mrr ?? 0),
      arr: result.arr + Number(customer.arr ?? 0),
      mrrKnown: result.mrrKnown || customer.mrr !== null,
      arrKnown: result.arrKnown || customer.arr !== null,
    }),
    {
      active: 0,
      liveFacilities: 0,
      liveBeds: 0,
      mrr: 0,
      arr: 0,
      mrrKnown: false,
      arrKnown: false,
    },
  );

  const metrics = [
    {
      label: "Active customers",
      value: formatNumber(totals.active),
      detail: "Current relationships",
      icon: UsersRound,
    },
    {
      label: "Facilities live",
      value: formatNumber(totals.liveFacilities),
      detail: "Marked live in CRM",
      icon: HousePlug,
    },
    {
      label: "Beds live",
      value: formatNumber(totals.liveBeds),
      detail: "Recorded beds only",
      icon: BedDouble,
    },
    {
      label: "Recorded MRR",
      value: totals.mrrKnown ? formatCurrency(totals.mrr) : "Not recorded",
      detail: totals.mrrKnown ? "Known customer records" : "No known values",
      icon: CircleDollarSign,
    },
    {
      label: "Recorded ARR",
      value: totals.arrKnown ? formatCurrency(totals.arr) : "Not recorded",
      detail: totals.arrKnown ? "Known customer records" : "No known values",
      icon: CircleDollarSign,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Post-win lifecycle"
        title="Customers"
        description="Closed won is the beginning: track contracts, onboarding, live facilities, renewal, inactivity, churn, and future expansion."
      />

      <section
        className="mb-5 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-label="Customer overview metrics"
      >
        {metrics.map((metric) => (
          <MetricTile key={metric.label} {...metric} />
        ))}
      </section>

      <section className="card overflow-hidden rounded-[8px]" aria-labelledby="customer-portfolio-heading">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-emerald-100 bg-[#e7faf2] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <CustomerIconWell icon={UsersRound} />
            <div className="min-w-0">
              <h2 id="customer-portfolio-heading" className="text-sm font-semibold text-[#164c38]">
                Customer portfolio
              </h2>
              <p className="mt-0.5 hidden text-xs text-[#4f7566] sm:block">
                Contract, onboarding, adoption and renewal facts from customer records
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#18523b] ring-1 ring-inset ring-emerald-900/10">
            {formatNumber(customers.length)} total
          </span>
        </div>

        {customers.length ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-[#f7faf8] text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-4 py-3">Lifecycle</th>
                    <th className="px-4 py-3">Onboarding</th>
                    <th className="px-4 py-3">Facilities</th>
                    <th className="px-4 py-3">Beds live</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">ARR</th>
                    <th className="px-4 py-3">Renewal</th>
                    <th className="w-12">
                      <span className="sr-only">Open customer</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => {
                    const statusTone =
                      customer.status === "active"
                        ? "green"
                        : customer.status === "churned"
                          ? "red"
                          : "slate";
                    return (
                      <tr key={customer.id} className="group transition-colors hover:bg-emerald-50/35">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e7faf2] text-xs font-bold text-[#18523b] ring-1 ring-inset ring-emerald-800/10"
                              aria-hidden="true"
                            >
                              {customerInitials(customer.provider_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{customer.provider_name}</p>
                              <p className="mt-0.5 text-xs text-slate-600">
                                Customer since {formatDate(customer.customer_since)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge tone={statusTone}>
                            <span
                              className={`mr-1.5 size-1.5 rounded-full ${
                                customer.status === "active"
                                  ? "bg-emerald-500"
                                  : customer.status === "churned"
                                    ? "bg-rose-500"
                                    : "bg-slate-400"
                              }`}
                              aria-hidden="true"
                            />
                            {humaniseStatus(customer.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {humaniseStatus(customer.onboarding_state)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold tabular-nums text-slate-800">
                            {formatNumber(customer.facilities_live)} live
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {formatNumber(customer.facilities_contracted)} contracted
                          </p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-800">
                          {formatNumber(customer.beds_live)}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-slate-700">
                          {formatCurrency(customer.mrr)}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-slate-700">
                          {formatCurrency(customer.arr)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                            <CalendarClock className="size-3.5 text-slate-600" aria-hidden="true" />
                            {formatDate(customer.renewal_date)}
                          </p>
                        </td>
                        <td className="px-3 py-3.5">
                          <Link
                            href={withReturnTo(`/providers/${customer.provider_id}?tab=commercial#customer`, "/customers")}
                            className="inline-grid size-8 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            aria-label={`Open ${customer.provider_name} commercial context`}
                          >
                            <ArrowUpRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {customers.map((customer) => {
                const statusTone =
                  customer.status === "active"
                    ? "green"
                    : customer.status === "churned"
                      ? "red"
                      : "slate";
                return (
                  <article key={customer.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7faf2] text-xs font-bold text-[#18523b] ring-1 ring-inset ring-emerald-800/10"
                        aria-hidden="true"
                      >
                        {customerInitials(customer.provider_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{customer.provider_name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Customer since {formatDate(customer.customer_since)}
                        </p>
                      </div>
                      <Link
                        href={withReturnTo(`/providers/${customer.provider_id}?tab=commercial#customer`, "/customers")}
                        className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        aria-label={`Open ${customer.provider_name}`}
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone}>
                        <span
                          className={`mr-1.5 size-1.5 rounded-full ${
                            customer.status === "active"
                              ? "bg-emerald-500"
                              : customer.status === "churned"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                          }`}
                          aria-hidden="true"
                        />
                        {humaniseStatus(customer.status)}
                      </Badge>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {humaniseStatus(customer.onboarding_state)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-[8px] border border-slate-200 bg-[#fbfdfc] min-[520px]:grid-cols-4">
                      <div className="border-b border-r border-slate-200 p-3 min-[520px]:border-b-0">
                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Facilities
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                          {formatNumber(customer.facilities_live)} / {formatNumber(customer.facilities_contracted)}
                        </dd>
                      </div>
                      <div className="border-b border-slate-200 p-3 min-[520px]:border-b-0 min-[520px]:border-r">
                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                          Beds live
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                          {formatNumber(customer.beds_live)}
                        </dd>
                      </div>
                      <div className="border-r border-slate-200 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                          MRR
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                          {formatCurrency(customer.mrr)}
                        </dd>
                      </div>
                      <div className="p-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                          ARR
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                          {formatCurrency(customer.arr)}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock className="size-3.5 text-slate-600" aria-hidden="true" />
                      <span className="font-medium text-slate-600">Renewal</span>
                      {formatDate(customer.renewal_date)}
                    </p>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <CommercialEmptyState
            title="No customer relationships yet"
            description="Customers are created from Closed Won opportunities and continue into onboarding, live service and renewal. Open Pipeline to progress an active opportunity."
            href="/pipeline"
            actionLabel="Open Pipeline"
          />
        )}
      </section>
    </div>
  );
}
