# Route map

`src/app` is the Next.js URL layer, not the whole frontend and not the backend.

| Route | Entry point | Owning capability |
| --- | --- | --- |
| `/` | `page.tsx` | `features/landing` public visual gateway |
| `/login` | `login/page.tsx` | Authentication |
| `/dashboard` | `(app)/dashboard/page.tsx` | Command centre |
| `/providers` | `(app)/providers/page.tsx` | Market directory |
| `/providers/[id]` | `(app)/providers/[id]/page.tsx` | `features/accounts` |
| `/opportunities/[id]` | `(app)/opportunities/[id]/page.tsx` | Commercial operations |
| `/pipeline` | `(app)/pipeline/page.tsx` | Commercial operations |
| `/tasks` | `(app)/tasks/page.tsx` | Commercial operations |
| `/customers` | `(app)/customers/page.tsx` | Customer lifecycle |
| `/search` | `(app)/search/page.tsx` | Global retrieval |
| `/data-health` | `(app)/data-health/page.tsx` | `features/data-health` |
| `/visits` | `(app)/visits/page.tsx` | `features/visits` |

`(app)` is a Next.js route group. Its name does not appear in URLs; it applies the authenticated application shell.
