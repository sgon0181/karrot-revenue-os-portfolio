# Commercial operations

Reusable user-facing concepts for Layer B commercial truth and internally isolated practice records.

```text
components/commercial-forms.tsx  Opportunity, activity and next-action forms
components/commercial-empty-state.tsx  Guided empty states for commercial routes
lib/commercial.ts                Record modes, due-state and commercial URL helpers
```

Durable commercial truth lives in Supabase tables: contacts, opportunities, activities, next actions, customer relationships and customer facilities. Provider-anchored mutation orchestration currently lives in `features/accounts/server/actions.ts`.

Forms do not expose a real/sandbox selector. Commands derive mode from the provider: authoritative accounts create `real` records and the durable sample account creates internal `sandbox` records, with database triggers enforcing the same boundary. Sample CRM records appear through the ordinary Pipeline, Tasks, Customers and account UI with the sample cue supplied by names. Pipeline and Customers view-local summaries aggregate every displayed record, including visible sample records; official Home/database commercial and revenue aggregates continue to use only `real` rows.

The owner-only `reset_sandbox_commercial_data` function is internal maintenance, not a product surface. It removes non-sample practice records and deliberately preserves the durable sample fixtures.

Do not infer pipeline stage from provider registration, research confidence or a score. A human commercial workflow controls opportunity state.
