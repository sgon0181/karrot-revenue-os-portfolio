# Infrastructure adapters

This directory connects product code to external systems. It does not own product behaviour.

`supabase/` contains browser/server clients, authentication/session handling and generated database types. `database.types.ts` is generated from the schema and must not be hand-edited.

Future external adapters should be grouped by provider here when they are shared across capabilities. Capability-specific orchestration remains inside the owning feature's `server/` directory.
