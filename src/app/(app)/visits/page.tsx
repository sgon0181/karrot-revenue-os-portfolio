import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/server";
import { PageHeader } from "@/shared/components/page-header";
import { FieldPlanner } from "@/features/visits/components/field-planner";
import {
  addDays,
  formatPlannerDate,
  isMonday,
  mondayForSydneyDate,
  PlannerContact,
  PlannerFacility,
  PlannerVisit,
} from "@/features/visits/lib/planner";
import { sydneyLocalDateTimeToIso } from "@/shared/lib/format";
import { getAuthenticatedPrincipal } from "@/infrastructure/supabase/auth";

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = week && isMonday(week) ? week : mondayForSydneyDate();
  const nextMonday = addDays(monday, 7);
  const startsAt = sydneyLocalDateTimeToIso(`${monday}T00:00`);
  const endsAt = sydneyLocalDateTimeToIso(`${nextMonday}T00:00`);
  if (!startsAt || !endsAt) throw new Error("Unable to resolve planner week");

  const supabase = await createClient();
  const [principal, facilitiesResult, contactsResult, visitsResult] = await Promise.all([
    getAuthenticatedPrincipal(),
    supabase.from("v_facility_latest").select("id, provider_id, provider_name, name, full_address, suburb, postcode, latitude, longitude, is_sample").order("name"),
    supabase.from("contacts").select("id, provider_id, facility_id, full_name, title, phone, record_mode").order("full_name"),
    supabase.from("field_visits").select("id, title, facility_id, contact_id, starts_at, ends_at, status, notes, record_mode").gte("starts_at", startsAt).lt("starts_at", endsAt).order("starts_at"),
  ]);
  for (const result of [facilitiesResult, contactsResult, visitsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const contacts = (contactsResult.data ?? []) as Array<{
    id: string;
    provider_id: string;
    facility_id: string | null;
    full_name: string;
    title: string | null;
    phone: string | null;
    record_mode: string;
  }>;
  const facilities: PlannerFacility[] = (facilitiesResult.data ?? [])
    .filter((facility): facility is typeof facility & {
      id: string;
      provider_id: string;
      provider_name: string;
      name: string;
      full_address: string;
      suburb: string;
      postcode: string;
    } => Boolean(facility.id && facility.provider_id && facility.provider_name && facility.name && facility.full_address && facility.suburb && facility.postcode))
    .map((facility) => ({
    id: facility.id,
    providerId: facility.provider_id,
    providerName: facility.provider_name,
    name: facility.name,
    address: facility.full_address,
    suburb: facility.suburb,
    postcode: facility.postcode,
    latitude: facility.latitude === null ? null : Number(facility.latitude),
    longitude: facility.longitude === null ? null : Number(facility.longitude),
    isSample: facility.is_sample === true,
    contacts: contacts
      .filter((contact) => contact.provider_id === facility.provider_id
        && contact.record_mode === (facility.is_sample === true ? "sandbox" : "real")
        && (contact.facility_id === null || contact.facility_id === facility.id))
      .map((contact): PlannerContact => ({
        id: contact.id,
        facilityId: contact.facility_id,
        fullName: contact.full_name,
        title: contact.title,
        phone: contact.phone,
      })),
    }));
  const visitStatuses = new Set<PlannerVisit["status"]>(["tentative", "confirmed", "completed", "cancelled"]);
  const visits: PlannerVisit[] = (visitsResult.data ?? [])
    .filter((visit): visit is typeof visit & { status: PlannerVisit["status"] } => visitStatuses.has(visit.status as PlannerVisit["status"]))
    .map((visit) => ({
      id: visit.id,
      title: visit.title,
      facilityId: visit.facility_id,
      contactId: visit.contact_id,
      startsAt: visit.starts_at,
      endsAt: visit.ends_at,
      status: visit.status,
      notes: visit.notes,
      recordMode: visit.record_mode === "sandbox" ? "sandbox" : "real",
    }));
  const canEdit = principal.role === "owner" || principal.role === "editor";

  return (
    <div>
      <PageHeader
        eyebrow="Field operating plan"
        title="Field Planner"
        description="Click any 30-minute time slot to add a facility visit, contact and destination."
        action={(
          <div className="flex items-center gap-2">
            <Link href={`/visits?week=${addDays(monday, -7)}`} className="button-secondary" aria-label="Previous week"><ChevronLeft className="size-4" /> Previous</Link>
            <Link href="/visits" className="button-secondary">This week</Link>
            <Link href={`/visits?week=${nextMonday}`} className="button-secondary" aria-label="Next week">Next <ChevronRight className="size-4" /></Link>
          </div>
        )}
      />
      <div className="mb-4 flex items-center justify-between rounded-[7px] border border-[#dce6e1] bg-white px-4 py-3">
        <p className="font-semibold text-[#1f352c]">Week of {formatPlannerDate(monday, { day: "numeric", month: "long", year: "numeric" })}</p>
        <p className="text-xs font-medium text-[#64726c]">Sydney time · 30-minute slots · Drag visits to reschedule</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <FieldPlanner monday={monday} facilities={facilities} visits={visits} canEdit={canEdit} />
      </div>
    </div>
  );
}
