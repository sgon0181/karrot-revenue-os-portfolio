"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";
import { createClient } from "@/infrastructure/supabase/server";
import { sydneyLocalDateTimeToIso } from "@/shared/lib/format";
import { isValidPlannerSlot, type PlannerContact } from "@/features/visits/lib/planner";

const visitStatus = z.enum(["tentative", "confirmed", "completed", "cancelled"]);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

async function editableContext() {
  const [supabase, principal] = await Promise.all([
    createClient(),
    getAuthenticatedPrincipal(),
  ]);
  if (principal.role !== "owner" && principal.role !== "editor") throw new Error("Editor access required");
  return supabase;
}

function thirtyMinutesAfter(isoValue: string) {
  return new Date(new Date(isoValue).valueOf() + 30 * 60 * 1000).toISOString();
}

function plannerStart(localInput: string) {
  const local = localDateTime.parse(localInput);
  if (!isValidPlannerSlot(local)) {
    throw new Error("Choose a Monday–Friday time between 08:00 and 17:30 in 30-minute steps.");
  }
  const iso = sydneyLocalDateTimeToIso(local);
  if (!iso) throw new Error("Visit start time is required");
  return iso;
}

export type PlannerMutationResult = { ok: true } | { ok: false; message: string };

async function activeConflictMessage(
  supabase: Awaited<ReturnType<typeof editableContext>>,
  facilityId: string,
  startsAt: string,
  endsAt: string,
  recordMode: "real" | "sandbox",
  excludeVisitId?: string,
) {
  let query = supabase
    .from("field_visits")
    .select("id, facility_id")
    .neq("status", "cancelled")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .eq("record_mode", recordMode)
    .limit(1);
  if (excludeVisitId) query = query.neq("id", excludeVisitId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.facility_id === facilityId) {
    return "This facility already has an active visit that overlaps that time.";
  }
  return "Another active visit already overlaps that time. Choose a different slot or cancel the existing visit first.";
}

export async function scheduleFieldVisit(
  facilityIdInput: string,
  startsAtLocalInput: string,
  titleInput: string,
  contactIdInput?: string | null,
) {
  const facilityId = z.string().uuid().parse(facilityIdInput);
  const contactId = contactIdInput ? z.string().uuid().parse(contactIdInput) : null;
  const title = z.string().trim().min(1).max(200).parse(titleInput);
  const startsAt = plannerStart(startsAtLocalInput);
  const endsAt = thirtyMinutesAfter(startsAt);
  const supabase = await editableContext();
  const { data: facility, error: facilityError } = await supabase
    .from("facilities")
    .select("id, provider_id, is_sample")
    .eq("id", facilityId)
    .is("archived_at", null)
    .maybeSingle();
  if (facilityError) throw new Error(facilityError.message);
  if (!facility) throw new Error("Facility not found");
  if (contactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .eq("provider_id", facility.provider_id)
      .eq("record_mode", facility.is_sample ? "sandbox" : "real")
      .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);
    if (!contact) throw new Error("That contact is not available for this facility");
  }
  const recordMode = facility.is_sample ? "sandbox" : "real";
  const conflict = await activeConflictMessage(supabase, facilityId, startsAt, endsAt, recordMode);
  if (conflict) return { ok: false, message: conflict } satisfies PlannerMutationResult;
  const { error } = await supabase.from("field_visits").insert({
    title,
    facility_id: facilityId,
    contact_id: contactId,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "tentative",
    record_mode: recordMode,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  return { ok: true } satisfies PlannerMutationResult;
}

export async function createPlannerContact(input: {
  facilityId: string;
  fullName: string;
  title?: string;
  phone?: string;
}): Promise<PlannerContact> {
  const parsed = z.object({
    facilityId: z.string().uuid(),
    fullName: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(80).optional(),
  }).parse(input);
  const supabase = await editableContext();
  const { data: facility, error: facilityError } = await supabase
    .from("facilities")
    .select("id, provider_id, is_sample")
    .eq("id", parsed.facilityId)
    .is("archived_at", null)
    .maybeSingle();
  if (facilityError) throw new Error(facilityError.message);
  if (!facility) throw new Error("Facility not found");
  const { data: contact, error } = await supabase.from("contacts").insert({
    provider_id: facility.provider_id,
    facility_id: facility.id,
    full_name: parsed.fullName,
    title: parsed.title || null,
    phone: parsed.phone || null,
    record_mode: facility.is_sample ? "sandbox" : "real",
  }).select("id, facility_id, full_name, title, phone").single();
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  revalidatePath(`/providers/${facility.provider_id}`);
  return {
    id: contact.id,
    facilityId: contact.facility_id,
    fullName: contact.full_name,
    title: contact.title,
    phone: contact.phone,
  };
}

export async function moveFieldVisit(visitIdInput: string, startsAtLocalInput: string) {
  const visitId = z.string().uuid().parse(visitIdInput);
  const startsAt = plannerStart(startsAtLocalInput);
  const supabase = await editableContext();
  const { data: visit, error: readError } = await supabase
    .from("field_visits")
    .select("facility_id, starts_at, ends_at, record_mode")
    .eq("id", visitId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!visit) throw new Error("Visit not found");
  const durationMs = Math.max(30 * 60 * 1000, new Date(visit.ends_at).valueOf() - new Date(visit.starts_at).valueOf());
  const endsAt = new Date(new Date(startsAt).valueOf() + durationMs).toISOString();
  const conflict = await activeConflictMessage(
    supabase,
    visit.facility_id,
    startsAt,
    endsAt,
    visit.record_mode === "sandbox" ? "sandbox" : "real",
    visitId,
  );
  if (conflict) return { ok: false, message: conflict } satisfies PlannerMutationResult;
  const { error } = await supabase
    .from("field_visits")
    .update({ starts_at: startsAt, ends_at: endsAt })
    .eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  return { ok: true } satisfies PlannerMutationResult;
}

export async function updateFieldVisit(formData: FormData) {
  const parsed = z.object({
    visitId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    visitTime: z.string().regex(/^\d{2}:\d{2}$/),
    contactId: z.union([z.string().uuid(), z.literal("")]),
    status: visitStatus,
    notes: z.string().max(2000),
  }).parse({
    visitId: String(formData.get("visit_id") ?? ""),
    title: String(formData.get("title") ?? ""),
    visitDate: String(formData.get("visit_date") ?? ""),
    visitTime: String(formData.get("visit_time") ?? ""),
    contactId: String(formData.get("contact_id") ?? ""),
    status: String(formData.get("status") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  const supabase = await editableContext();
  const startsAt = plannerStart(`${parsed.visitDate}T${parsed.visitTime}`);
  const { data: visit, error: visitError } = await supabase
    .from("field_visits")
    .select("facility_id, starts_at, ends_at, record_mode")
    .eq("id", parsed.visitId)
    .maybeSingle();
  if (visitError) throw new Error(visitError.message);
  if (!visit) throw new Error("Visit not found");
  const durationMs = Math.max(30 * 60 * 1000, new Date(visit.ends_at).valueOf() - new Date(visit.starts_at).valueOf());
  const endsAt = new Date(new Date(startsAt).valueOf() + durationMs).toISOString();
  if (parsed.status !== "cancelled") {
    const conflict = await activeConflictMessage(
      supabase,
      visit.facility_id,
      startsAt,
      endsAt,
      visit.record_mode === "sandbox" ? "sandbox" : "real",
      parsed.visitId,
    );
    if (conflict) return { ok: false, message: conflict } satisfies PlannerMutationResult;
  }
  const { error } = await supabase.from("field_visits").update({
    title: parsed.title,
    starts_at: startsAt,
    ends_at: endsAt,
    contact_id: parsed.contactId || null,
    status: parsed.status,
    notes: parsed.notes.trim() || null,
  }).eq("id", parsed.visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  return { ok: true } satisfies PlannerMutationResult;
}

export async function deleteFieldVisit(visitIdInput: string) {
  const visitId = z.string().uuid().parse(visitIdInput);
  const supabase = await editableContext();
  const { error } = await supabase.from("field_visits").delete().eq("id", visitId);
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  return { ok: true } satisfies PlannerMutationResult;
}
