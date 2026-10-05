# Data Health / evidence operations

Owns the internal operator workspace for government-source provenance, import health, web-intelligence coverage, data-quality issues and deterministic match review.

```text
components/data-health-workspace.tsx  Full evidence-operations workspace
components/match-review-controls.tsx  Interactive confirm/reject/reset controls
components/presentation.tsx           Data-health status and display helpers
lib/pagination.ts                     Independent, query-backed table pagination
server/actions.ts                     Authenticated match-review commands
server/load-data-health.ts             Evidence-operations read model composition
```

The UI is not the integrity boundary. `review_facility_match` remains a database function protected by RLS, grants and role checks. Official provider/facility totals and research coverage exclude durable sample rows.

This capability must never silently repair ambiguous source data. A reviewer action requires editor or owner access, an evidence acknowledgement, attribution and append-only history. Viewers see the queue and provenance without mutation controls. The owner-only `reset_sandbox_commercial_data` function remains internal maintenance, preserves sample fixtures and has no Data Health or other product UI.
