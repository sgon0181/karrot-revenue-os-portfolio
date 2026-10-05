# Ingestion service

This src-layout Python package audits and imports pinned government publications deterministically. Run it from the repository root through `npm run data:audit` and `npm run data:import`; those commands set the package path consistently for local and CI execution.

Rows marked `is_sample` are durable product fixtures, not government-source records. Reconciliation excludes them from the official provider/facility counts, disappearance archival and the facility matching index, so a source refresh cannot archive a sample fixture or use it to resolve an authoritative source row.
