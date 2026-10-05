# Product feature ownership

Each directory owns a user-recognisable capability. Open its README before making a change.

| Feature | Owns |
| --- | --- |
| `landing/` | Anonymous visual gateway, representative particle story and secure-login hand-off |
| `accounts/` | Provider-anchored account workspace, account commands and provider-derived practice mode |
| `commercial/` | Reusable opportunity, activity and next-action concepts and mode-free forms |
| `data-health/` | Source/import health, match review, quality issues and authoritative coverage |
| `intelligence/` | Research execution, structured briefs, evidence, epistemic states, human review and sample exclusion |
| `market/` | Authoritative provider search/browse, maps, research status and per-user recent-workspace history |
| `visits/` | Titled field itinerary UI, planning helpers and authenticated visit commands |

Feature code may use `shared` and `infrastructure`. Features should not import route modules from `src/app`.
