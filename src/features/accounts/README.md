# Accounts

Owns the provider-anchored commercial workspace: the place where authoritative or sample provider/facility context, commercial truth and reviewed intelligence are composed for a user.

```text
components/provider-workspace.tsx  Account workspace composition and presentation
components/contact-form.tsx        Contact capture/editing UI
components/source-trace.tsx        Canonical source and rating presentation
server/actions.ts                  Authenticated account, CRM and intelligence commands
server/provider-record-mode.ts          Provider-derived commercial record mode
server/load-provider-workspace.ts  Provider/account read model composition
server/load-research-memory.ts     Paged intelligence history retrieval
```

The URL remains `/providers/[id]` because the stable anchor is a provider organisation, whether authoritative or sample. “Account workspace” is the product concept; it is not a duplicate database entity. The URL-backed workspace tabs are `overview`, `people`, `intelligence`, `commercial`, and `evidence`; a selected facility is preserved through `facility=<uuid>`.

CRM contacts are durable identities. Public research candidates stay separate until a human adds them. Future role, organisation, facility, email, phone, or currentness changes are stored as pending proposals, reviewed by an editor/owner, and retained with append-only verification history rather than overwriting or deleting earlier details.

The durable sample provider uses this same workspace and the same account commands. **Sample** is communicated through its provider/facility names, not a global banner, badge or form selector. New contacts, opportunities, activities, next actions, customers and Planner contacts derive their internal `record_mode` from the provider on the server; database triggers independently force records for a sample provider into `sandbox`. Authoritative providers derive `real`. Sample facilities carry no government lineage, so their Overview and Evidence states must remain honestly empty rather than imitate canonical ratings or care data.

This module may compose `commercial`, `intelligence` and `market` capabilities. It must not bypass Supabase RLS or promote an intelligence claim without the database review function.
