import { z } from "zod";

const nullableText = z.string().trim().min(1).nullable();
const nullableIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const accountBriefSchema = z.object({
  sources: z.array(z.object({
    title: z.string().trim().min(1),
    publisher: nullableText,
    url: z.string().url(),
    source_type: z.enum([
      "official_provider",
      "official_government",
      "annual_report",
      "news",
      "professional_profile",
      "conference",
      "other",
    ]),
    published_at: nullableIsoDate,
    updated_at: nullableIsoDate,
    excerpt: nullableText,
  })).max(30),
  claims: z.array(z.object({
    category: z.enum(["organisation", "person", "signal", "gap", "hypothesis", "approach"]),
    section: z.enum([
      "Account Snapshot",
      "Facility Snapshot",
      "Organisation",
      "People Worth Investigating",
      "Potential Karrot Relevance",
      "Recent Signals",
      "Operational / Strategic Context",
      "Research Gaps",
      "What We Know",
      "What We Think",
      "What We Don't Know",
      "Questions Worth Asking",
      "Suggested Discovery Questions",
      "Recommended Next Step",
    ]),
    statement: z.string().trim().min(1),
    epistemic_state: z.enum(["known", "hypothesis", "unknown"]),
    confidence: z.enum(["high", "medium", "low"]),
    person_name: nullableText,
    person_title: nullableText,
    potential_relevance: nullableText,
    observed_at: nullableIsoDate,
    source_urls: z.array(z.string().url()).max(8),
  })).min(1).max(50),
});

export type AccountBrief = z.infer<typeof accountBriefSchema>;

export const accountBriefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sources", "claims"],
  properties: {
    sources: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "publisher", "url", "source_type", "published_at", "updated_at", "excerpt"],
        properties: {
          title: { type: "string" },
          publisher: { type: ["string", "null"] },
          url: { type: "string" },
          source_type: { enum: ["official_provider", "official_government", "annual_report", "news", "professional_profile", "conference", "other"] },
          published_at: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          updated_at: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          excerpt: { type: ["string", "null"] },
        },
      },
    },
    claims: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "section", "statement", "epistemic_state", "confidence", "person_name", "person_title", "potential_relevance", "observed_at", "source_urls"],
        properties: {
          category: { enum: ["organisation", "person", "signal", "gap", "hypothesis", "approach"] },
          section: { enum: ["Account Snapshot", "Facility Snapshot", "Organisation", "People Worth Investigating", "Potential Karrot Relevance", "Recent Signals", "Operational / Strategic Context", "Research Gaps", "What We Know", "What We Think", "What We Don't Know", "Questions Worth Asking", "Suggested Discovery Questions", "Recommended Next Step"] },
          statement: { type: "string" },
          epistemic_state: { enum: ["known", "hypothesis", "unknown"] },
          confidence: { enum: ["high", "medium", "low"] },
          person_name: { type: ["string", "null"] },
          person_title: { type: ["string", "null"] },
          potential_relevance: { type: ["string", "null"] },
          observed_at: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          source_urls: { type: "array", maxItems: 8, items: { type: "string" } },
        },
      },
    },
  },
} as const;
