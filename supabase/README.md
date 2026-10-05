# Database backend

This is the primary durable backend for Karrot Revenue OS: PostgreSQL schema, business invariants, authentication integration, Row Level Security and reporting views.

```text
config.toml   Local Supabase/Auth configuration
migrations/   Append-only production database changes
seed.sql      Optional local seed entry point
```

Migration groups:

- `core_data` : Layer A government sources, canonical providers/facilities, snapshots and deterministic match state.
- `crm` and `level_2_operate` : Layer B contacts, opportunities, activities, tasks, customers and sandbox isolation.
- `account_intelligence` and later M3 migrations : Layer C research jobs, evidence, claims, review events and approved commercial facts.
- `views_and_security` : read models, RLS and least-privilege grants.

Rules:

1. Never edit a migration that has reached hosted Supabase; add a forward migration.
2. Keep canonical source snapshots append-only.
3. Enforce critical integrity and authorisation in PostgreSQL, not only in UI code.
4. Regenerate `src/infrastructure/supabase/database.types.ts` after schema changes.
5. Verify schema/RLS changes with `tests/integration/database/verify_crm.sql`.
