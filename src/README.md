# Web application source

This directory contains the deployed Next.js application.

```text
app/             URL entry points, layouts and authentication actions
features/        Product capability ownership
infrastructure/  Supabase and other external-system adapters
shared/          Reusable UI and dependency-light utilities
```

Start at the root [`START_HERE.md`](../START_HERE.md). Route files should be thin: they translate URL inputs and compose a feature. Database queries, mutations and substantial UI belong to the owning feature.

Dependency direction:

```text
app -> features -> infrastructure/shared
app -> infrastructure/shared
shared -X-> features
infrastructure -X-> app
```
