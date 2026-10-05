import { createClient } from "@/infrastructure/supabase/server";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { pageRange } from "@/features/data-health/lib/pagination";
import { researchFreshnessPolicy } from "@/features/intelligence/lib/freshness";

export async function loadDataHealth(pages: { runs: number; issues: number; queue: number; history: number }) {
  const supabase = await createClient();
  const principalPromise = getAuthenticatedPrincipal();
  const runsRange = pageRange(pages.runs);
  const issuesRange = pageRange(pages.issues);
  const queueRange = pageRange(pages.queue);
  const historyRange = pageRange(pages.history);
  const freshnessPolicy = researchFreshnessPolicy();
  const [healthResult, sourceFilesResult, runsResult, runningImportsResult, issuesResult, reviewQueueResult, reviewHistoryResult, providerTotalResult, facilityTotalResult, researchCoverageResult] = await Promise.all([
    supabase
      .from("v_data_import_health")
      .select("*")
      .order("latest_import_started_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("source_files")
      .select("id, dataset_code, title, publisher, source_url, file_name, sha256, compiled_at, source_as_of_date, reporting_start_date, reporting_end_date, acquired_at, schema_version")
      .order("acquired_at", { ascending: false }),
    supabase
      .from("import_runs")
      .select("id, source_file_id, importer_version, status, started_at, finished_at, rows_processed, records_created, records_updated, matched_records, unmatched_records, unresolved_records, duplicate_candidates, error_count, error_message", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(runsRange.from, runsRange.to),
    supabase
      .from("import_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    supabase
      .from("data_quality_issues")
      .select("id, source_file_id, source_record_id, entity_type, entity_id, issue_code, severity, status, summary, first_seen_at, last_seen_at, resolved_at, resolution_note", { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .range(issuesRange.from, issuesRange.to),
    supabase
      .from("v_match_review_queue")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(queueRange.from, queueRange.to),
    supabase
      .from("v_match_review_history")
      .select("*", { count: "exact" })
      .order("reviewed_at", { ascending: false })
      .range(historyRange.from, historyRange.to),
    supabase.from("providers").select("id", { count: "exact", head: true }).is("archived_at", null).eq("is_sample", false),
    supabase.from("facilities").select("id", { count: "exact", head: true }).is("archived_at", null).eq("is_sample", false),
    supabase.rpc("research_coverage_snapshot", { p_fresh_days: freshnessPolicy.scopeFreshDays }),
  ]);

  const principal = await principalPromise;
  for (const result of [healthResult, sourceFilesResult, runsResult, runningImportsResult, issuesResult, reviewQueueResult, reviewHistoryResult, providerTotalResult, facilityTotalResult, researchCoverageResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const healthRows = healthResult.data ?? [];
  const sourceFiles = sourceFilesResult.data ?? [];
  const runs = runsResult.data ?? [];
  const issues = issuesResult.data ?? [];
  const reviewQueue = reviewQueueResult.data ?? [];
  const reviewHistory = reviewHistoryResult.data ?? [];
  const sourceFileById = new Map(sourceFiles.map((source) => [source.id, source]));
  const latestRowsProcessed = healthRows.reduce((total, source) => total + Number(source.rows_processed ?? 0), 0);
  const openIssues = healthRows.reduce((total, source) => total + Number(source.open_issues ?? 0), 0);
  const openErrors = healthRows.reduce((total, source) => total + Number(source.open_errors ?? 0), 0);
  const healthySources = healthRows.filter(
    (source) =>
      source.latest_import_status === "succeeded" &&
      Number(source.open_issues ?? 0) === 0 &&
      Number(source.open_errors ?? 0) === 0,
  ).length;
  const runningImports = runningImportsResult.count ?? 0;
  const coverageSnapshot = researchCoverageResult.data?.[0];

  return {
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
    role: principal.role,
    canReview: principal.role === "owner" || principal.role === "editor",
    researchCoverage: {
      providerCompleted: Number(coverageSnapshot?.provider_completed ?? 0),
      providerTotal: providerTotalResult.count ?? 0,
      facilityCompleted: Number(coverageSnapshot?.facility_completed ?? 0),
      facilityTotal: facilityTotalResult.count ?? 0,
      fresh: Number(coverageSnapshot?.fresh ?? 0),
      needsRefresh: Number(coverageSnapshot?.needs_refresh ?? 0),
      researching: Number(coverageSnapshot?.researching ?? 0),
      freshDays: freshnessPolicy.scopeFreshDays,
    },
    totals: {
      runs: runsResult.count ?? 0,
      issues: issuesResult.count ?? 0,
      queue: reviewQueueResult.count ?? 0,
      history: reviewHistoryResult.count ?? 0,
    },
    pages,
  };
}
