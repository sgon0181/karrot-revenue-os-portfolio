import "server-only";

import { accountBriefJsonSchema, accountBriefSchema, type AccountBrief } from "@/features/intelligence/lib/account-brief";

export type ResearchContext = {
  scope: "provider" | "facility";
  provider: {
    business_name: string;
    entity_name: string;
    abn: string;
    registration_status: string | null;
  };
  facilities: Array<{
    id: string;
    name: string;
    address: string | null;
    suburb: string | null;
    postcode: string | null;
    acqsc_site_id: string;
  }>;
  target_facility: {
    id: string;
    name: string;
    address: string | null;
    suburb: string | null;
    postcode: string | null;
    acqsc_site_id: string;
  } | null;
  existing_contacts: Array<{
    full_name: string;
    title: string | null;
    facility_id: string | null;
  }>;
  existing_provider_intelligence: Array<{
    statement: string;
    epistemic_state: string;
    observed_at: string | null;
    knowledge_layer: "research" | "human_approved_commercial";
  }>;
  previous_scope_intelligence: Array<{
    statement: string;
    epistemic_state: string;
    observed_at: string | null;
    knowledge_layer: "research" | "human_approved_commercial";
  }>;
};

type OpenAIResponse = {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; annotations?: unknown[] }>;
    action?: unknown;
  }>;
  usage?: Record<string, unknown>;
  error?: { message?: string; code?: string };
};

export type AccountResearchResult = {
  model: string;
  responseId: string;
  usage: Record<string, unknown>;
  brief: AccountBrief;
};

export type AccountResearchProgress =
  | { status: "pending" }
  | { status: "completed"; result: AccountResearchResult };

const karrotPublicContext = {
  verified_public_positioning: "Karrot Care publicly describes its work as turning routine aged-care data into personalised clinical insight intended to improve residents' quality of life and reduce preventable decline.",
  stated_problem: "Karrot says important determinants and outcomes can be buried in high-volume, unstructured clinical text and that it combines text-based clinical information with quantitative information to understand an individual's health trajectory.",
  commercial_stage: "Karrot publicly described a first live facility, a pre-revenue stage and a per-bed SaaS model whose pricing and packaging remain under validation.",
  boundaries: [
    "Do not claim proven clinical outcomes, ROI, regulatory approval, integrations or procurement readiness.",
    "This context helps identify relevant roles and discovery questions; it is not evidence that a provider needs Karrot.",
    "For each named person, try to include a direct public linkedin.com/in/ profile only when web search actually surfaces it and the result corroborates the person's name plus employer or role. Mark it professional_profile and attach the exact URL to that person's source_urls.",
    "Never construct, guess or scrape a LinkedIn URL. Ambiguity or absence is normal and must not weaken or fail the brief; stronger official evidence should establish the person's current role when available.",
  ],
};

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function collectCitedUrls(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectCitedUrls(item, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === "url" && typeof child === "string") {
      const normalized = normalizedUrl(child);
      if (normalized) result.add(normalized);
    } else if (key !== "text") {
      collectCitedUrls(child, result);
    }
  }
  return result;
}

function outputText(response: OpenAIResponse) {
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function enforceCitationBoundary(brief: AccountBrief, response: OpenAIResponse): AccountBrief {
  const citedUrls = collectCitedUrls(response);
  const acceptedNormalizedUrls = new Set<string>();
  const sources = brief.sources.filter((source) => {
    const normalized = normalizedUrl(source.url);
    if (normalized === null || !citedUrls.has(normalized) || acceptedNormalizedUrls.has(normalized)) return false;
    acceptedNormalizedUrls.add(normalized);
    return true;
  });
  // Persistence joins claims to sources by exact URL. Map normalized-equivalent
  // model URLs back to the exact accepted source URL so a harmless hash or
  // trailing-slash difference cannot detach the claim from its evidence.
  const canonicalSourceUrls = new Map(
    sources.flatMap((source) => {
      const normalized = normalizedUrl(source.url);
      return normalized ? [[normalized, source.url] as const] : [];
    }),
  );
  const claims = brief.claims.map((claim) => {
    const sourceUrls = [...new Set(claim.source_urls.flatMap((url) => {
      const normalized = normalizedUrl(url);
      const canonical = normalized ? canonicalSourceUrls.get(normalized) : null;
      return canonical ? [canonical] : [];
    }))];
    // A model can describe an unknown role in the people section without
    // identifying a person. Preserve that useful absence as a research gap;
    // the database correctly reserves person claims for named people.
    const normalizedClaim = claim.category === "person" && claim.person_name === null
      ? {
          ...claim,
          category: "gap" as const,
          section: "Research Gaps" as const,
          epistemic_state: "unknown" as const,
          confidence: "low" as const,
          person_title: null,
          potential_relevance: null,
        }
      : claim;
    if (normalizedClaim.epistemic_state === "known" && (sourceUrls.length === 0 || normalizedClaim.observed_at === null)) {
      return {
        ...normalizedClaim,
        epistemic_state: "unknown" as const,
        confidence: "low" as const,
        observed_at: normalizedClaim.observed_at,
        source_urls: sourceUrls,
      };
    }
    return { ...normalizedClaim, source_urls: sourceUrls };
  });
  return { sources, claims };
}

function openAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Account research is not configured. Add OPENAI_API_KEY to the server environment."), {
      code: "openai_key_missing",
    });
  }
  return apiKey;
}

function requestError(payload: OpenAIResponse, status: number) {
  return Object.assign(
    new Error(payload.error?.message ?? `OpenAI request failed with ${status}`),
    {
      code: payload.error?.code ?? `openai_http_${status}`,
      retryable: status === 408 || status === 409 || status === 429 || status >= 500,
    },
  );
}

async function responsePayload(response: Response) {
  try {
    return await response.json() as OpenAIResponse;
  } catch {
    if (!response.ok) throw requestError({}, response.status);
    throw Object.assign(new Error("OpenAI returned an unreadable account research response."), {
      code: "openai_invalid_response",
    });
  }
}

function terminalResponseError(payload: OpenAIResponse) {
  if (payload.status === "incomplete") {
    return Object.assign(new Error(`OpenAI returned an incomplete account brief (${payload.incomplete_details?.reason ?? "unknown reason"}).`), {
      code: "openai_incomplete_response",
    });
  }
  return Object.assign(
    new Error(payload.error?.message ?? `OpenAI account research ended with status ${payload.status ?? "unknown"}.`),
    { code: payload.error?.code ?? `openai_${payload.status ?? "unexpected_status"}` },
  );
}

function completedResearch(payload: OpenAIResponse, model: string): AccountResearchResult {
  const responseId = payload.id;
  if (!responseId) {
    throw Object.assign(new Error("OpenAI returned account research without a response identifier."), {
      code: "openai_missing_response_id",
    });
  }
  const text = outputText(payload);
  if (!text) {
    throw Object.assign(new Error("OpenAI returned no structured account brief."), { code: "openai_empty_response" });
  }
  const parsed = accountBriefSchema.parse(JSON.parse(text));
  return {
    model,
    responseId,
    usage: payload.usage ?? {},
    brief: enforceCitationBoundary(parsed, payload),
  };
}

export function isRetryableResearchError(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return true;
  if (error instanceof TypeError) return true;
  return Boolean(typeof error === "object" && error && "retryable" in error && error.retryable === true);
}

export async function startAccountResearch(context: ResearchContext) {
  const apiKey = openAIKey();
  const model = process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5.6-terra";
  const today = new Date().toISOString().slice(0, 10);
  const targetInstruction = context.scope === "facility" && context.target_facility
    ? `Research the specific residential aged-care facility ${context.target_facility.name} (${context.target_facility.acqsc_site_id}) for a responsible commercial operator preparing a visit or first conversation. Focus on facility-specific public context, its current Facility Manager, Director of Nursing or equivalent local clinical/operational leadership, local contact channels, recent local announcements and useful visit preparation. Use the supplied provider intelligence as context and do not restate group-level facts unless they are essential to understanding this facility.`
    : "Research this Australian residential aged-care provider for a commercial operator preparing a responsible first approach. Focus on organisation structure, portfolio, leadership, strategy, public initiatives, technology/digital context and current corporate developments; do not attempt a deep profile of every facility.";
  const sectionInstruction = context.scope === "facility"
    ? "Use Facility Snapshot and Operational / Strategic Context where applicable."
    : "Use Account Snapshot and Operational / Strategic Context where applicable.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      background: true,
      store: false,
      tools: [{ type: "web_search", search_context_size: "low", user_location: { type: "approximate", country: "AU", city: "Sydney", region: "NSW", timezone: "Australia/Sydney" } }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      reasoning: { effort: "low" },
      max_output_tokens: 8_000,
      text: {
        verbosity: "medium",
        format: { type: "json_schema", name: "account_intelligence_brief", strict: true, schema: accountBriefJsonSchema },
      },
      input: `${targetInstruction} Today is ${today}.\n\nCanonical and prior context (canonical fields are trusted Layer A; human_approved_commercial items are Layer B memory; research items remain probabilistic Layer C and must be reverified):\n${JSON.stringify(context)}\n\nKarrot public context and boundaries:\n${JSON.stringify(karrotPublicContext)}\n\nRules:\n- Search the public web with no more than four focused searches. Prefer current official provider/facility pages, official reports, annual reports, conference biographies, government sources and reputable recent announcements, in that order.\n- ${sectionInstruction}\n- Treat previous_scope_intelligence as comparison context only. Surface material new, changed, conflicting or now-unverified information when current evidence safely supports that distinction; never claim a change merely because a prior search missed something.\n- Respect human-approved Layer B wording as commercial memory, but do not present it as current public evidence unless today's sources independently support it. Rejected and superseded claims are intentionally absent and must not be reconstructed from inference.\n- Existing contacts include facility scope. For facility research, do not attribute a provider-wide contact to the selected home without current facility-specific evidence.\n- Do not repeat canonical ABN, registration, address, portfolio or government performance facts unless essential to the commercial context or contradicted by a current source. AI research must never reinterpret canonical data as product need.\n- Every KNOWN claim must cite one or more URLs actually used in web search and set observed_at to ${today}, the date the claim was checked.\n- published_at is the source publication date when reliably available; updated_at is a distinct page/report update date when reliably available; otherwise use null.\n- Never infer a person's buying authority and never invent an email address. Describe an evidenced person as a Person Worth Investigating or Potentially Relevant Stakeholder. Return at most five people, favouring publicly verified CEO, facility management, Director of Nursing/equivalent clinical leadership, regional/residential operations, clinical governance or information/data/technology roles.\n- Use HYPOTHESIS only for possible Karrot relevance and explain why it is a hypothesis. Never convert a government quality measure into an assertion of product need.\n- Use UNKNOWN/GAP explicitly when reliable evidence is absent, stale or conflicting. Surface conflicting current-role evidence rather than choosing silently.\n- Make suggested discovery questions specific to the stated Karrot problem while preserving the product boundaries.\n- Recommend one responsible next commercial or research step; do not draft outreach and do not claim sufficient evidence to contact a named person unless role relevance is established.\n- Produce 12–20 material claims total across a concise snapshot, people, signals, operational/strategic context, known/hypothesis/unknown, research gaps, suggested discovery questions and one recommended next step. Prefer fewer well-supported claims over exhaustive repetition.\n- Do not provide medical, clinical, regulatory or procurement conclusions beyond the sources.\n- Do not invent URLs, names, dates, systems, initiatives or facts.`,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw requestError(payload, response.status);
  }
  if (payload.status === "failed" || payload.status === "cancelled" || payload.status === "incomplete") {
    throw terminalResponseError(payload);
  }
  if (!payload.id) {
    throw Object.assign(new Error("OpenAI did not accept the background research request."), {
      code: "openai_missing_response_id",
    });
  }
  return {
    model,
    responseId: payload.id,
    status: payload.status ?? "queued",
  };
}

export async function retrieveAccountResearch(responseId: string, model: string): Promise<AccountResearchProgress> {
  const url = new URL(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`);
  // Retrieval has its own include contract. The include supplied when the
  // background response was created does not guarantee consulted web sources
  // are present in this later payload.
  // OpenAI models `include` as an array on retrieval, whose wire-level query
  // name is `include[]`. Sending the scalar key is rejected as `invalid_type`.
  url.searchParams.append("include[]", "web_search_call.action.sources");
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${openAIKey()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw requestError(payload, response.status);
  if (payload.status === "queued" || payload.status === "in_progress") return { status: "pending" };
  if (payload.status !== "completed") throw terminalResponseError(payload);
  return { status: "completed", result: completedResearch(payload, model) };
}

export async function cancelAccountResearch(responseId: string) {
  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey()}` },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
