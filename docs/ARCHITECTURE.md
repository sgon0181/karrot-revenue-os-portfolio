# Architecture and trust boundaries

The application is a modular monolith. Next.js routes compose features. Feature server commands authenticate the operator before calling Supabase. PostgreSQL owns persistent invariants, foreign keys, role checks and audit history. The Python importer is a separate privileged runtime and never executes in the browser.

Canonical records preserve source lineage. Human-operated CRM records represent decisions and actions. Intelligence records preserve probabilistic claims and supporting sources until review. UI labels alone do not establish this separation; migrations, database functions and application commands enforce it.

Research responses are untrusted. Structured validation and source references improve reviewability but do not prove truth. Operators approve, reject or correct claims. Unknown values remain unknown.

The public edition intentionally starts without the original government datasets. Fictional sample accounts have a durable sample marker and are excluded from authoritative market counts. The original application is single-workspace; a production multi-tenant product would require additional tenant keys, scoped policies, provider credentials, quotas and tests.
