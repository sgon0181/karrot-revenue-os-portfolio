# Account intelligence

Owns public-web research sources, claims, epistemic state, gaps, hypotheses, recommendations and human review. User-facing copy calls this **Web intelligence**; internal layer terminology is retained only where it helps architecture and data-boundary documentation.

```text
components/account-intelligence.tsx   Provider/facility brief and review UI
components/research-submit-button.tsx  Research progress affordance
lib/account-brief.ts                   Zod and structured-output contract
lib/freshness.ts                       Staleness policy and status
server/openai-research.ts              Server-only Responses API/web-search adapter
```

Safety boundary:

```text
research output -> stored intelligence claim -> human approve/correct -> commercial fact
                                      \-> reject -> audit history only
```

- A model cannot write canonical government truth.
- A source-less assertion cannot be stored as `known`.
- OpenAI credentials remain server-only.
- Paid research starts only from an explicit authenticated human form submission carrying `research_intent=manual`. Rendering, navigation, pipeline movement, appointments and timers never start it.
- Manual sourced capture remains available when the research runtime is unavailable.
- The durable sample provider and facility are not research targets. The UI omits Research/Refresh and manual sourced capture, the research-start RPC and table trigger fail closed, and coverage aggregates exclude sample scopes.
