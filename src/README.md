# Web application source

This directory contains the Next.js application source for the public portfolio edition.

```text
app/             URL entry points, layouts and authentication actions
features/        Product capability ownership
infrastructure/  Supabase and other external-system adapters
shared/          Reusable UI and dependency-light utilities
```

Start at the root [README](../README.md). Route files should be thin: they translate URL inputs and compose a feature. Database queries, mutations and substantial UI belong to the owning feature.

Dependency direction:

```text
app -> features -> infrastructure/shared
app -> infrastructure/shared
shared -X-> features
infrastructure -X-> app
```
