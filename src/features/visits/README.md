# Field visit planning

This feature owns the human-controlled weekly itinerary at `/visits`.

| Path | Responsibility |
| --- | --- |
| `components/field-planner.tsx` | Interactive weekly planner, facility search and nearby suggestions |
| `lib/planner.ts` | Sydney-week calculations, distances, serialisable planner types and Maps URLs |
| `server/actions.ts` | Authenticated schedule, move, update and remove commands |
| `src/app/(app)/visits/page.tsx` | Route-level read composition and page shell |

The planner reads authoritative and sample facilities but stores user-decided visits in commercial truth. Every visit has a required, editable title that leads its board card while the facility remains visible as context. It must not change canonical government records, infer travel times, schedule autonomously or attach a contact from an unrelated provider/facility. Viewers remain read-only; editors and owners mutate through RLS-constrained server actions. Server actions accept only weekday 30-minute operating slots and return user-facing conflicts when an active visit overlaps the requested time.

Visits and Planner-created contacts derive mode from the selected facility. The sample facility produces internal `sandbox` records and authoritative facilities produce `real` records; database triggers enforce matching provider/facility/contact scope. The Planner does not add sample badges or a mode selector.
