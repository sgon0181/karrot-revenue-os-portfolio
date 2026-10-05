export const MANUAL_RESEARCH_INTENT = "manual";

export function assertManualResearchIntent(formData: FormData) {
  if (formData.get("research_intent") !== MANUAL_RESEARCH_INTENT) {
    throw new Error("Paid research requires an explicit manual request.");
  }
}
