"use server";

// Evidence-operations commands. Database functions remain the durable authorisation boundary.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";

export type ReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const reviewSchema = z.object({
  decision_id: z.coerce.number().int().positive(),
  action: z.enum(["confirm", "reject", "reset"]),
  facility_id: z.string().uuid().optional().or(z.literal("")),
  site_id: z.string().trim().max(100).optional().or(z.literal("")),
  review_note: z.string().trim().min(3, "Add a review note of at least 3 characters.").max(1000),
  confirmation: z.string().refine((value) => value === "confirmed", "Confirm that you checked the evidence and understand the audit effect."),
});

export async function reviewFacilityMatch(
  _previousState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const parsed = reviewSchema.safeParse({
    decision_id: formData.get("decision_id"),
    action: formData.get("action"),
    facility_id: formData.get("facility_id") ?? "",
    site_id: formData.get("site_id") ?? "",
    review_note: formData.get("review_note"),
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Review submission is invalid.",
    };
  }

  const [supabase, principal] = await Promise.all([
    createClient(),
    getAuthenticatedPrincipal(),
  ]);
  if (principal.role !== "owner" && principal.role !== "editor") {
    return { status: "error", message: "Editor or owner access is required to review facility matches." };
  }

  let facilityId = parsed.data.facility_id || undefined;
  if (parsed.data.action === "confirm" && !facilityId && parsed.data.site_id) {
    const facilityResult = await supabase
      .from("facilities")
      .select("id")
      .eq("acqsc_site_id", parsed.data.site_id)
      .is("archived_at", null)
      .maybeSingle();
    if (facilityResult.error) {
      return { status: "error", message: facilityResult.error.message };
    }
    facilityId = facilityResult.data?.id;
  }

  if (parsed.data.action === "confirm" && !facilityId) {
    return { status: "error", message: "Choose a candidate or enter a valid ACQSC Site ID." };
  }

  const result = await supabase.rpc("review_facility_match", {
    p_decision_id: parsed.data.decision_id,
    p_action: parsed.data.action,
    p_facility_id: facilityId,
    p_review_note: parsed.data.review_note,
  });

  if (result.error) {
    return { status: "error", message: result.error.message };
  }

  revalidatePath("/data-health");
  return {
    status: "success",
    message:
      parsed.data.action === "confirm"
        ? "Match confirmed and snapshot created."
        : parsed.data.action === "reject"
          ? "Observation rejected with an audit event."
          : "Decision returned to the review queue.",
  };
}
