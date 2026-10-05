# Market

Owns lightweight helpers around the authoritative provider/facility universe and explicit sample-account discovery.

```text
components/provider-workspace-view-recorder.tsx  Records an actual mounted account view
lib/maps.ts                                   Google Maps navigation URL construction
lib/provider-search.ts                        Provider pagination and facility-focused result helpers
server/actions.ts                             Authenticated personal navigation commands
server/provider-research-jobs.ts              Provider-level research status inputs for visible directory rows
```

The Providers default is personal navigation state: up to ten provider accounts the authenticated user actually opened, persisted server-side and isolated by user. Search and registration filtering query the shared Supabase directory views while preserving the authoritative/sample boundary described below. Recent-account history must never be inferred from research, commercial activity, facility cards, or globally shared timestamps.

The normal Browse all view and its count remain authoritative and exclude sample accounts. An explicit provider/facility search may return a matching sample account as an ordinary result, global search may return its provider/facility/CRM records, and a sample account may appear in a user's recents after they open it. Explicit sample identity comes from provider/facility names, not a banner or sample badge. Directory research status is derived from provider-wide research jobs for only the visible and recent accounts; sample rows report research unavailable. The page applies the same sample eligibility rule to its count and row queries, while database read models preserve the official market and research-coverage boundaries.
