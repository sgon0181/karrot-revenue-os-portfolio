import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Database,
  FileCheck2,
  FileClock,
  FileWarning,
  History,
  Info,
  Rows3,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { SuccessToast } from "@/shared/components/success-toast";
import { Badge } from "@/shared/components/ui";
import { formatDate, formatNumber } from "@/shared/lib/format";
import { MatchReviewControls, ReturnToReviewControl } from "@/features/data-health/components/match-review-controls";
import {
  candidateSummary,
  importStatus,
  issueStatus,
  observedMatchIdentity,
  PanelHeader,
  runStatus,
  StatusPill,
  SummaryCard,
} from "@/features/data-health/components/presentation";
import { loadDataHealth } from "@/features/data-health/server/load-data-health";
import { DATA_HEALTH_PAGE_SIZE, type DataHealthPageKey, type DataHealthSearchParams, pageNumber, paginationHref, totalPages } from "@/features/data-health/lib/pagination";

// This server component presents evidence operations. Query composition lives
// in load-data-health and durable review/integrity rules remain in PostgreSQL.

function PaginationNav({ label, pageKey, currentPage, total, params }: { label: string; pageKey: DataHealthPageKey; currentPage: number; total: number; params: DataHealthSearchParams }) {
  const pages = totalPages(total);
  if (pages <= 1) return null;
  return (
    <nav aria-label={`${label} pagination`} className="flex flex-col gap-2 border-t border-[#e2eae6] bg-[#f8faf9] px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>Page {currentPage} of {pages} · {formatNumber(total)} records · {DATA_HEALTH_PAGE_SIZE} per page</p>
      <div className="flex gap-2">
        {currentPage > 1 ? <Link href={paginationHref(params, pageKey, currentPage - 1)} className="button-secondary min-h-8 px-2.5 py-1 text-xs"><ChevronLeft className="size-3.5" /> Previous</Link> : <span className="inline-flex min-h-8 items-center px-2.5 text-slate-400">First page</span>}
        {currentPage < pages ? <Link href={paginationHref(params, pageKey, currentPage + 1)} className="button-secondary min-h-8 px-2.5 py-1 text-xs">Next <ChevronRight className="size-3.5" /></Link> : <span className="inline-flex min-h-8 items-center px-2.5 text-slate-400">Last page</span>}
      </div>
    </nav>
  );
}

export async function DataHealthWorkspace({ searchParams }: { searchParams: Promise<DataHealthSearchParams> }) {
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const requestedPages = {
    runs: pageNumber(params.runsPage),
    issues: pageNumber(params.issuesPage),
    queue: pageNumber(params.queuePage),
    history: pageNumber(params.historyPage),
  };
  const {
    healthRows,
    runs,
    issues,
    reviewQueue,
    reviewHistory,
    sourceFileById,
    latestRowsProcessed,
    openIssues,
    openErrors,
    healthySources,
    runningImports,
    role,
    canReview,
    researchCoverage,
    totals,
    pages,
  } = await loadDataHealth(requestedPages);

  return (
    <div>
      {notice ? <SuccessToast message={notice} /> : null}
      <PageHeader
        eyebrow="Lineage and observability"
        title="Data health"
        description="Trace each dataset from immutable source file to import run and recorded quality issue. The view reports observed facts without inventing freshness thresholds."
      />

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-5 text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          A successful import confirms that the recorded run completed. It does not independently certify the publisher&apos;s data as current or complete.
        </p>
      </div>

      <section aria-label="Data health summary" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Registered sources"
          value={formatNumber(healthRows.length)}
          detail={`${formatNumber(healthySources)} have a successful latest run and no open issues`}
          icon={Database}
        />
        <SummaryCard
          label="Latest-run rows"
          value={formatNumber(latestRowsProcessed)}
          detail="Sum of rows processed by each source’s latest run"
          icon={Rows3}
          tone="blue"
        />
        <SummaryCard
          label="Recent runs"
          value={formatNumber(totals.runs)}
          detail={runningImports ? `${formatNumber(runningImports)} currently marked running` : "All accessible import runs"}
          icon={History}
          tone={runningImports ? "blue" : "slate"}
        />
        <SummaryCard
          label="Open issues"
          value={formatNumber(openIssues)}
          detail="All severities across registered source files"
          icon={FileWarning}
          tone={openIssues ? "amber" : "green"}
        />
        <SummaryCard
          label="Open errors"
          value={formatNumber(openErrors)}
          detail="Open issues explicitly recorded with error severity"
          icon={ShieldAlert}
          tone={openErrors ? "red" : "green"}
        />
        <SummaryCard
          label="Match review queue"
          value={formatNumber(totals.queue)}
          detail="Unresolved or unmatched facility observations"
          icon={TriangleAlert}
          tone={totals.queue ? "amber" : "green"}
        />
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]" aria-labelledby="research-coverage-heading">
        <PanelHeader
          id="research-coverage-heading"
          title="Web intelligence coverage"
          description="Operational evidence coverage across the government-listed market. Research remains manually initiated from an account."
          icon={FileCheck2}
          aside={<Badge tone="blue">{formatNumber(researchCoverage.providerCompleted + researchCoverage.facilityCompleted)} researched scopes</Badge>}
        />
        <dl className="grid gap-px bg-[#dce6e1] sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white p-4">
            <dt className="text-xs font-semibold text-[#64726c]">Provider research</dt>
            <dd className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#183128]">{formatNumber(researchCoverage.providerCompleted)} / {formatNumber(researchCoverage.providerTotal)}</dd>
            <p className="mt-1 text-xs text-[#64726c]">Providers with a completed brief</p>
          </div>
          <div className="bg-white p-4">
            <dt className="text-xs font-semibold text-[#64726c]">Facility research</dt>
            <dd className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#183128]">{formatNumber(researchCoverage.facilityCompleted)} / {formatNumber(researchCoverage.facilityTotal)}</dd>
            <p className="mt-1 text-xs text-[#64726c]">Facilities with a completed brief</p>
          </div>
          <div className="bg-white p-4">
            <dt className="text-xs font-semibold text-[#64726c]">Recently updated</dt>
            <dd className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#17623f]">{formatNumber(researchCoverage.fresh)}</dd>
            <p className="mt-1 text-xs text-[#64726c]">Updated within {researchCoverage.freshDays} days</p>
          </div>
          <div className="bg-white p-4">
            <dt className="text-xs font-semibold text-[#64726c]">Needs refresh</dt>
            <dd className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#725300]">{formatNumber(researchCoverage.needsRefresh)}</dd>
            <p className="mt-1 text-xs text-[#64726c]">Aging, stale, or failed after prior completion</p>
          </div>
        </dl>
        {researchCoverage.researching ? <p className="border-t border-[#e7edea] bg-[#f7faf8] px-4 py-2.5 text-xs text-[#52635b]">{formatNumber(researchCoverage.researching)} {researchCoverage.researching === 1 ? "scope is" : "scopes are"} currently researching.</p> : null}
      </section>

      <section
        aria-labelledby="source-provenance-heading"
        className="overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
      >
        <PanelHeader
          id="source-provenance-heading"
          title="Source provenance"
          description="Latest import outcome, publisher snapshot, immutable checksum, and observed reconciliation counts."
          icon={FileCheck2}
          aside={(
            <span className="w-fit rounded-md border border-[#bddbcc] bg-white/75 px-2.5 py-1 text-xs font-bold text-[#245b45]">
              {formatNumber(healthRows.length)} files
            </span>
          )}
        />

        {healthRows.length ? (
          <div className="grid gap-3 bg-[#f5f8f6] p-3 lg:grid-cols-2 2xl:grid-cols-3">
            {healthRows.map((source) => {
              const sourceFile = source.source_file_id ? sourceFileById.get(source.source_file_id) : undefined;
              const openSourceIssues = Number(source.open_issues ?? 0);
              const openSourceErrors = Number(source.open_errors ?? 0);
              const status = importStatus(source.latest_import_status, openSourceIssues, openSourceErrors);
              return (
                <article key={source.source_file_id} className="rounded-lg border border-[#dce5e0] bg-white p-3.5 shadow-[0_1px_2px_rgba(19,75,53,0.035)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#35785d]">{source.dataset_code}</p>
                      <h3 className="mt-1 text-[13px] font-semibold leading-5 text-slate-950">{source.title}</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500" title={source.publisher ?? undefined}>{source.publisher ?? "Publisher not recorded"}</p>
                    </div>
                    <StatusPill label={status.label} tone={status.tone} icon={status.icon} />
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Rows</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-slate-800">{formatNumber(source.rows_processed)}</dd>
                    </div>
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Matched</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-slate-800">{formatNumber(source.matched_records)}</dd>
                    </div>
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Unresolved</dt>
                      <dd className={`mt-0.5 text-xs font-semibold ${Number(source.unresolved_records ?? 0) ? "text-amber-700" : "text-slate-800"}`}>
                        {formatNumber(source.unresolved_records)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Created</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-slate-800">{formatNumber(source.records_created)}</dd>
                    </div>
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Updated</dt>
                      <dd className="mt-0.5 text-xs font-semibold text-slate-800">{formatNumber(source.records_updated)}</dd>
                    </div>
                    <div className="rounded-md bg-[#f2f7f4] px-2 py-2">
                      <dt className="text-slate-500">Open issues</dt>
                      <dd className={`mt-0.5 text-xs font-semibold ${openSourceIssues ? "text-amber-700" : "text-slate-800"}`}>
                        {formatNumber(source.open_issues)}
                      </dd>
                    </div>
                  </dl>

                  <dl className="mt-3 space-y-2 border-t border-[#e7edea] pt-3 text-xs leading-4">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Latest run</dt>
                      <dd className="text-right font-medium text-slate-700">{formatDate(source.latest_import_finished_at, true)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Source as at</dt>
                      <dd className="text-right font-medium text-slate-700">{formatDate(source.source_as_of_date)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Reporting window</dt>
                      <dd className="text-right font-medium text-slate-700">
                        {source.reporting_start_date || source.reporting_end_date
                          ? `${formatDate(source.reporting_start_date)} – ${formatDate(source.reporting_end_date)}`
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Schema</dt>
                      <dd className="text-right font-medium text-slate-700">{sourceFile?.schema_version ?? "Not recorded"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">Compiled</dt>
                      <dd className="text-right font-medium text-slate-700">{formatDate(sourceFile?.compiled_at, true)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">File</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{source.file_name}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">SHA-256</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs leading-4 text-slate-500">{source.sha256}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7edea] pt-3">
                    <p className="text-xs text-slate-500">Acquired {formatDate(sourceFile?.acquired_at, true)}</p>
                    {source.source_url ? (
                      <a
                        href={source.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-[#146744] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#134b35] focus-visible:ring-offset-2"
                      >
                        Open publication <ArrowUpRight className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">No source URL recorded</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center px-6 py-10 text-center">
            <div>
              <Database className="mx-auto size-6 text-slate-600" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold text-slate-800">No source files are registered</h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                Provenance and import health will appear after a source file and its first ingestion run are recorded.
              </p>
            </div>
          </div>
        )}
      </section>

      <section
        aria-labelledby="import-history-heading"
        className="mt-5 overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
      >
        <PanelHeader
          id="import-history-heading"
          title="Import run history"
          description="Newest accessible runs with recorded processing, matching, and failure outcomes."
          icon={History}
          aside={(
            <span className="w-fit rounded-md border border-[#bddbcc] bg-white/75 px-2.5 py-1 text-xs font-bold text-[#245b45]">
              {formatNumber(totals.runs)} total
            </span>
          )}
        />

        {runs.length ? (
          <div
            aria-label="Import run history. Scroll horizontally for all columns."
            className="overflow-x-auto"
            role="region"
            tabIndex={0}
          >
            <table className="w-full min-w-[1060px] text-left text-xs">
              <caption className="sr-only">The latest import runs, their status, timings, row counts, reconciliation counts, and importer version.</caption>
              <thead className="border-b border-[#dfe8e3] bg-[#f3f8f5] text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                <tr>
                  <th scope="col" className="px-3.5 py-2.5">Source</th>
                  <th scope="col" className="px-3.5 py-2.5">Status</th>
                  <th scope="col" className="px-3.5 py-2.5">Timing</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">Rows</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">Matched</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">Created / updated</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right">Unmatched / unresolved</th>
                  <th scope="col" className="px-3.5 py-2.5">Importer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7edea]">
                {runs.map((run) => {
                  const source = sourceFileById.get(run.source_file_id);
                  const status = runStatus(run.status);
                  return (
                    <tr key={run.id} className="align-top transition-colors hover:bg-[#f8fbf9]">
                      <td className="px-3.5 py-3">
                        <p className="max-w-56 font-semibold text-slate-800">{source?.title ?? "Unknown source file"}</p>
                        <p className="mt-0.5 max-w-56 truncate font-mono text-xs text-slate-500" title={source?.file_name}>{source?.file_name ?? run.source_file_id}</p>
                      </td>
                      <td className="px-3.5 py-3">
                        <StatusPill label={status.label} tone={status.tone} icon={status.icon} />
                        {run.error_count ? <p className="mt-1.5 text-xs font-medium text-rose-700">{formatNumber(run.error_count)} errors recorded</p> : null}
                      </td>
                      <td className="px-3.5 py-3 text-xs leading-4 text-slate-600">
                        <p>Started {formatDate(run.started_at, true)}</p>
                        <p className="mt-0.5 text-slate-500">Finished {formatDate(run.finished_at, true)}</p>
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-slate-800">{formatNumber(run.rows_processed)}</td>
                      <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-slate-800">{formatNumber(run.matched_records)}</td>
                      <td className="px-3.5 py-3 text-right tabular-nums text-slate-700">
                        {formatNumber(run.records_created)} / {formatNumber(run.records_updated)}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums text-slate-700">
                        {formatNumber(run.unmatched_records)} / {formatNumber(run.unresolved_records)}
                        {Number(run.duplicate_candidates ?? 0) ? <p className="mt-0.5 text-xs text-amber-700">{formatNumber(run.duplicate_candidates)} duplicate candidates</p> : null}
                      </td>
                      <td className="px-3.5 py-3">
                        <code className="text-xs text-slate-600">{run.importer_version}</code>
                        {run.error_message ? <p className="mt-1 max-w-56 text-xs leading-4 text-rose-700" title={run.error_message}>{run.error_message}</p> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center px-6 py-8 text-center">
            <div>
              <FileClock className="mx-auto size-5 text-slate-600" aria-hidden />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">No import runs recorded</h3>
              <p className="mt-1 text-xs text-slate-500">Run history will appear after ingestion starts.</p>
            </div>
          </div>
        )}
        <PaginationNav label="Import run history" pageKey="runsPage" currentPage={pages.runs} total={totals.runs} params={params} />
      </section>

      <section
        aria-labelledby="match-review-heading"
        className="mt-5 overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
      >
        <PanelHeader
          id="match-review-heading"
          title="Facility match review queue"
          description="Confirm a supported facility or reject the observation. Every resolution requires a note and creates an attributed audit event."
          icon={TriangleAlert}
          aside={(
            <span className="w-fit rounded-md border border-[#e5c76e] bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
              {formatNumber(totals.queue)} records
            </span>
          )}
        />

        {reviewQueue.length ? (
          <div className="divide-y divide-[#e5ece8]">
            {reviewQueue.map((item) => {
              const observed = observedMatchIdentity(item.raw_data);
              return (
                <article key={item.id} className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-[#f8fbf9] lg:grid-cols-[minmax(0,1fr)_220px_240px] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill
                        label={item.status === "unmatched" ? "Unmatched" : "Review required"}
                        tone="amber"
                        icon={TriangleAlert}
                      />
                      <code className="rounded bg-slate-100 px-1.5 py-1 text-xs text-slate-600">{item.dataset_code}</code>
                    </div>
                    <h3 className="mt-2 text-[13px] font-semibold leading-5 text-slate-900">{observed.name}</h3>
                    <p className="mt-0.5 text-xs leading-4 text-slate-600">{observed.context}</p>
                    <p className="mt-1 text-xs text-slate-500">Method: {item.match_method ?? "Not recorded"}</p>
                  </div>
                  <div className="text-xs leading-4 text-slate-600">
                    <p className="font-semibold text-slate-700">{item.file_name}</p>
                    <p className="mt-0.5">{item.sheet_name}, row {item.row_number}</p>
                    <p className="mt-1 text-slate-500">Recorded {formatDate(item.created_at, true)}</p>
                  </div>
                  <div className="text-xs leading-4 text-slate-600">
                    <p className="font-semibold text-slate-700">{formatNumber(item.candidate_count)} candidate{Number(item.candidate_count) === 1 ? "" : "s"}</p>
                    <p className="mt-1 text-slate-500">{candidateSummary(item.candidates)}</p>
                  </div>
                  {typeof item.id === "number" && canReview ? (
                    <div className="lg:col-span-3">
                      <MatchReviewControls decisionId={item.id} candidates={item.candidates} />
                    </div>
                  ) : typeof item.id === "number" ? <p className="lg:col-span-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong className="capitalize">{role}</strong> access is read-only. An editor or owner must resolve this observation.</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center px-6 py-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-6 text-emerald-600" aria-hidden />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">No facility matches await review</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
                Every accessible observation is currently matched or otherwise resolved.
              </p>
            </div>
          </div>
        )}
        <PaginationNav label="Facility match review queue" pageKey="queuePage" currentPage={pages.queue} total={totals.queue} params={params} />
      </section>

      <section
        aria-labelledby="match-review-history-heading"
        className="mt-5 overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
      >
        <PanelHeader
          id="match-review-history-heading"
          title="Match review history"
          description="Append-only reviewer actions with source locator, selected facility, note, and attribution."
          icon={History}
          aside={reviewHistory.length ? (
            <span className="w-fit rounded-md border border-[#bddbcc] bg-white/75 px-2.5 py-1 text-xs font-bold text-[#245b45]">
              {formatNumber(totals.history)} total
            </span>
          ) : undefined}
        />
        {reviewHistory.length ? (
          <div className="divide-y divide-[#e5ece8]">
            {reviewHistory.map((event) => (
              <article key={event.id} className="grid gap-3 px-4 py-3.5 md:grid-cols-[180px_minmax(0,1fr)_220px]">
                <div>
                  <StatusPill
                    label={event.action === "confirm" ? "Confirmed" : event.action === "reject" ? "Rejected" : "Returned to review"}
                    tone={event.action === "confirm" ? "green" : event.action === "reject" ? "slate" : "amber"}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{formatDate(event.reviewed_at, true)}</p>
                </div>
                <div className="min-w-0 text-xs leading-4 text-slate-600">
                  <p className="font-semibold text-slate-800">{event.facility_name ?? "No facility assigned"}</p>
                  <p className="mt-0.5">{event.acqsc_site_id ?? `${event.dataset_code} observation`}</p>
                  <p className="mt-1 text-slate-500">{event.review_note}</p>
                </div>
                <div className="text-xs leading-4 text-slate-600">
                  <p>{event.file_name}</p>
                  <p>{event.sheet_name}, row {event.row_number}</p>
                  <p className="mt-1 text-slate-500">By {event.reviewer_name ?? event.reviewed_by ?? "Unknown reviewer"}</p>
                  {canReview && event.action === "reject" && typeof event.decision_id === "number" ? (
                    <ReturnToReviewControl decisionId={event.decision_id} />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-32 place-items-center px-6 py-8 text-center">
            <div>
              <History className="mx-auto size-5 text-slate-500" aria-hidden />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">No manual reviews recorded</h3>
              <p className="mt-1 text-xs text-slate-500">Confirmed, rejected, and reset decisions will appear here.</p>
            </div>
          </div>
        )}
        <PaginationNav label="Match review history" pageKey="historyPage" currentPage={pages.history} total={totals.history} params={params} />
      </section>

      <section
        aria-labelledby="quality-issues-heading"
        className="mt-5 overflow-hidden rounded-lg border border-[#dce7e1] bg-white shadow-[0_1px_2px_rgba(19,75,53,0.04)]"
      >
        <PanelHeader
          id="quality-issues-heading"
          title="Quality issue register"
          description="Newest recorded findings, including resolved and ignored items for audit continuity."
          icon={AlertCircle}
          aside={issues.length ? (
            <span className="w-fit rounded-md border border-[#bddbcc] bg-white/75 px-2.5 py-1 text-xs font-bold text-[#245b45]">
              {formatNumber(totals.issues)} total
            </span>
          ) : undefined}
        />

        {issues.length ? (
          <div className="divide-y divide-[#e5ece8]">
            {issues.map((issue) => {
              const source = sourceFileById.get(issue.source_file_id);
              const status = issueStatus(issue.status, issue.severity);
              return (
                <article key={issue.id} className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-[#f8fbf9] md:grid-cols-[minmax(0,1fr)_170px_180px] md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill label={status.label} tone={status.tone} />
                      <span className="rounded-md bg-slate-100 px-1.5 py-1 text-xs font-semibold capitalize text-slate-600 ring-1 ring-inset ring-slate-200">
                        {issue.severity} severity
                      </span>
                      <code className="rounded bg-slate-100 px-1.5 py-1 text-xs text-slate-600">{issue.issue_code}</code>
                    </div>
                    <h3 className="mt-2 text-[13px] font-semibold leading-5 text-slate-900">{issue.summary}</h3>
                    {issue.resolution_note ? <p className="mt-1 text-xs leading-4 text-slate-600">Resolution: {issue.resolution_note}</p> : null}
                  </div>
                  <div className="text-xs leading-4 text-slate-600">
                    <p className="font-semibold text-slate-700">{source?.title ?? "Unknown source file"}</p>
                    <p className="mt-0.5">{issue.source_record_id ? `Source record ID ${issue.source_record_id}` : "No source record linked"}</p>
                    <p>{issue.entity_type ? `${issue.entity_type}${issue.entity_id ? ` · ${issue.entity_id}` : ""}` : "No canonical entity linked"}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 text-xs md:grid-cols-1 md:text-right">
                    <div>
                      <dt className="text-slate-500">First seen</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{formatDate(issue.first_seen_at, true)}</dd>
                    </div>
                    <div className="md:mt-2">
                      <dt className="text-slate-500">Last seen</dt>
                      <dd className="mt-0.5 font-medium text-slate-700">{formatDate(issue.last_seen_at, true)}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center px-6 py-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-6 text-emerald-600" aria-hidden />
              <h3 className="mt-2 text-sm font-semibold text-slate-800">No quality issues are recorded</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
                The accessible issue register is empty. This is not a substitute for an independent data-quality audit.
              </p>
            </div>
          </div>
        )}
        <PaginationNav label="Quality issue register" pageKey="issuesPage" currentPage={pages.issues} total={totals.issues} params={params} />
      </section>
    </div>
  );
}
