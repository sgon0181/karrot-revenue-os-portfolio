"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, Check, Clock3, GripVertical, LoaderCircle, MapPin, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { createPlannerContact, deleteFieldVisit, moveFieldVisit, scheduleFieldVisit, updateFieldVisit, type PlannerMutationResult } from "@/features/visits/server/actions";
import { addDays, facilityMatchesQuery, formatPlannerDate, googleMapsSearchUrl, haversineDistanceKm, localPlannerSlot, PlannerContact, PlannerFacility, PlannerVisit, PLANNER_END_HOUR, PLANNER_SLOT_MINUTES, PLANNER_START_HOUR, sharesPlannerBoundary, sydneyVisitParts } from "@/features/visits/lib/planner";

type DragPayload = { type: "facility" | "visit"; id: string };
type PlannerSlot = { date: string; hour: number; minute: number };

const statusStyles = {
  tentative: "border-amber-300 bg-amber-50 text-amber-950",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-950",
  completed: "border-slate-300 bg-slate-100 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

function dragPayload(event: React.DragEvent, payload: DragPayload) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-karrot-planner", JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", `${payload.type}:${payload.id}`);
}

function readDragPayload(event: React.DragEvent): DragPayload | null {
  try {
    return JSON.parse(event.dataTransfer.getData("application/x-karrot-planner")) as DragPayload;
  } catch {
    return null;
  }
}

function accountHref(facility: PlannerFacility) {
  return `/providers/${facility.providerId}?facility=${facility.id}#facility-${facility.id}`;
}

function slotLabel(slot: PlannerSlot) {
  return `${formatPlannerDate(slot.date, { weekday: "short", day: "numeric", month: "short" })} at ${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;
}

export function FieldPlanner({ monday, facilities, visits, canEdit }: {
  monday: string;
  facilities: PlannerFacility[];
  visits: PlannerVisit[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [composerSlot, setComposerSlot] = useState<PlannerSlot | null>(null);
  const [composerFacilityId, setComposerFacilityId] = useState<string | null>(null);
  const [composerContactId, setComposerContactId] = useState("");
  const [composerTitle, setComposerTitle] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [addedContacts, setAddedContacts] = useState<Record<string, PlannerContact[]>>({});
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(visits[0]?.id ?? null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(visits[0]?.facilityId ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRemoveVisitId, setConfirmRemoveVisitId] = useState<string | null>(null);
  const [mobileDay, setMobileDay] = useState(monday);

  const days = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(monday, index)), [monday]);
  const timeSlots = useMemo(() => Array.from(
    { length: ((PLANNER_END_HOUR - PLANNER_START_HOUR) * 60) / PLANNER_SLOT_MINUTES },
    (_, index) => {
      const totalMinutes = PLANNER_START_HOUR * 60 + index * PLANNER_SLOT_MINUTES;
      return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
    },
  ), []);
  const facilitiesById = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);
  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId) ?? null;
  const composerFacility = facilitiesById.get(composerFacilityId ?? "") ?? null;
  const anchorFacility = composerFacility ?? facilitiesById.get(selectedVisit?.facilityId ?? selectedFacilityId ?? "") ?? null;
  const scheduledFacilityIds = useMemo(() => new Set(visits.filter((visit) => visit.status !== "cancelled").map((visit) => visit.facilityId)), [visits]);

  const searchResults = useMemo(() => {
    return facilities
      .filter((facility) => facilityMatchesQuery(facility, query))
      .slice(0, 7);
  }, [facilities, query]);

  const recommendations = useMemo(() => {
    if (!anchorFacility) return [];
    const candidates = facilities
      .filter((facility) => facility.id !== anchorFacility.id && sharesPlannerBoundary(anchorFacility, facility) && !scheduledFacilityIds.has(facility.id))
      .map((facility) => ({ facility, distanceKm: haversineDistanceKm(anchorFacility, facility) }))
      .filter((candidate) => candidate.distanceKm !== null)
      .sort((left, right) => Number(left.distanceKm) - Number(right.distanceKm))
      .slice(0, 5);
    if (candidates.length) return candidates;
    return facilities
      .filter((facility) => facility.id !== anchorFacility.id && sharesPlannerBoundary(anchorFacility, facility) && !scheduledFacilityIds.has(facility.id))
      .filter((facility) => facility.postcode === anchorFacility.postcode || facility.suburb === anchorFacility.suburb)
      .slice(0, 5)
      .map((facility) => ({ facility, distanceKm: null }));
  }, [anchorFacility, facilities, scheduledFacilityIds]);

  const composerContacts = composerFacility
    ? Array.from(new Map([...composerFacility.contacts, ...(addedContacts[composerFacility.id] ?? [])].map((contact) => [contact.id, contact])).values())
    : [];

  function run(action: () => Promise<PlannerMutationResult>, onSuccess?: () => void, successMessage = "Planner updated.") {
    if (!canEdit) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.message);
          return;
        }
        onSuccess?.();
        setNotice(successMessage);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The planner could not save that change.");
      }
    });
  }

  function openComposer(slot: PlannerSlot, facilityId?: string) {
    if (!canEdit) return;
    setComposerSlot(slot);
    setComposerFacilityId(facilityId ?? null);
    setComposerContactId("");
    setComposerTitle("");
    setQuery("");
    setShowNewContact(false);
    setNewContactName("");
    setNewContactTitle("");
    setNewContactPhone("");
  }

  function chooseFacility(facility: PlannerFacility) {
    setComposerFacilityId(facility.id);
    setSelectedFacilityId(facility.id);
    setComposerContactId("");
    setComposerTitle(`${facility.name} visit`);
    setQuery("");
    setShowNewContact(false);
  }

  function handleDrop(event: React.DragEvent, slot: PlannerSlot) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload || !canEdit) return;
    const startsAt = localPlannerSlot(slot.date, slot.hour, slot.minute);
    if (payload.type === "facility") openComposer(slot, payload.id);
    else {
      setSelectedVisitId(payload.id);
      run(() => moveFieldVisit(payload.id, startsAt));
    }
  }

  function saveNewContact() {
    if (!composerFacility || !newContactName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const contact = await createPlannerContact({ facilityId: composerFacility.id, fullName: newContactName, title: newContactTitle, phone: newContactPhone });
        setAddedContacts((current) => ({ ...current, [composerFacility.id]: [...(current[composerFacility.id] ?? []), contact] }));
        setComposerContactId(contact.id);
        setShowNewContact(false);
        setNewContactName("");
        setNewContactTitle("");
        setNewContactPhone("");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The contact could not be saved.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <div role="alert" className="rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-800">{error}</div> : null}
      {!canEdit ? <div className="rounded-[7px] border border-[#cfded7] bg-[#f7faf8] px-4 py-2.5 text-sm text-[#43574e]"><strong>View-only access.</strong> An editor or owner can arrange visits.</div> : null}
      {notice ? <div role="status" aria-live="polite" className="rounded-[7px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">{notice}</div> : null}

      <div className="grid items-start gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3" aria-label="Planner sidebar">
          <section className="card overflow-hidden">
            <div className="border-b border-[#efd9d1] bg-[#fff0ea] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[#6f3929]">Recommended nearby</h2>
              <p className="mt-0.5 text-[11px] leading-4 text-[#7f5a4d]">{anchorFacility ? `Closest to ${anchorFacility.name}.` : "Select a visit or choose a facility in a time slot."}</p>
            </div>
            <div className="divide-y divide-[#e7edea]">
              {recommendations.map(({ facility, distanceKm }) => (
                <article key={facility.id} data-testid={`recommended-facility-${facility.id}`} draggable={canEdit} onDragStart={(event) => dragPayload(event, { type: "facility", id: facility.id })} className="group px-3.5 py-2.5 transition hover:bg-[#fffaf8]">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-[#b69c92]" />
                    <div className="min-w-0 flex-1">
                      <Link href={accountHref(facility)} className="block truncate text-xs font-semibold text-[#1f352c] hover:text-[#1f6548] hover:underline">{facility.name}</Link>
                      <p className="mt-0.5 truncate text-[11px] text-[#64726c]">{facility.suburb} · {distanceKm === null ? "same area" : `~${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`}</p>
                    </div>
                    {composerSlot ? <button type="button" onClick={() => chooseFacility(facility)} disabled={!canEdit} className="grid size-7 shrink-0 place-items-center rounded-full border border-[#edc5b7] bg-white text-[#b55336] hover:bg-[#fff0ea]" aria-label={`Add ${facility.name} to selected time`}><Plus className="size-3.5" /></button> : null}
                  </div>
                </article>
              ))}
              {!anchorFacility ? <div className="grid min-h-[150px] place-items-center px-5 text-center text-xs leading-5 text-[#64726c]"><div><MapPin className="mx-auto mb-2 size-5 text-[#dc9b86]" />Nearby suggestions appear after you select a scheduled facility.</div></div> : null}
              {anchorFacility && !recommendations.length ? <p className="px-4 py-8 text-center text-xs text-[#64726c]">No nearby suggestions are available.</p> : null}
            </div>
          </section>

          {selectedVisit && anchorFacility ? (
            <section className="card overflow-hidden" aria-label="Selected visit details">
              <div className="border-b border-[#dce6e1] px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2f7a58]">Selected visit</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#1f352c]">{selectedVisit.title}</p>
                <Link href={accountHref(anchorFacility)} className="mt-0.5 block truncate text-xs text-[#1f6548] hover:underline">{anchorFacility.name}</Link>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[#64726c]"><Clock3 className="size-3" />{sydneyVisitParts(selectedVisit.startsAt).time}–{sydneyVisitParts(selectedVisit.endsAt).time}</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); run(() => updateFieldVisit(new FormData(event.currentTarget)), undefined, "Visit details saved."); }} className="space-y-2.5 p-3.5">
                <input type="hidden" name="visit_id" value={selectedVisit.id} />
                <label className="block"><span className="label">Visit title</span><input className="input min-h-9 py-1.5 text-xs" name="title" defaultValue={selectedVisit.title} key={`${selectedVisit.id}-title-${selectedVisit.title}`} maxLength={200} required disabled={!canEdit || pending} /></label>
                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                  <label className="block"><span className="label">Date</span><input className="input min-h-9 py-1.5 text-xs" type="date" name="visit_date" min={monday} max={addDays(monday, 4)} defaultValue={sydneyVisitParts(selectedVisit.startsAt).date} key={`${selectedVisit.id}-date-${selectedVisit.startsAt}`} disabled={!canEdit || pending} /></label>
                  <label className="block"><span className="label">Time</span><select className="input min-h-9 py-1.5 text-xs" name="visit_time" defaultValue={sydneyVisitParts(selectedVisit.startsAt).time} key={`${selectedVisit.id}-time-${selectedVisit.startsAt}`} disabled={!canEdit || pending}>{timeSlots.map((slot) => { const value = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`; return <option key={value} value={value}>{value}</option>; })}</select></label>
                </div>
                <label className="block"><span className="label">Contact</span><select className="input min-h-9 py-1.5 text-xs" name="contact_id" defaultValue={selectedVisit.contactId ?? ""} key={`${selectedVisit.id}-${selectedVisit.contactId ?? "none"}`} disabled={!canEdit}><option value="">No contact assigned</option>{anchorFacility.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.title ? ` · ${contact.title}` : ""}</option>)}</select></label>
                <label className="block"><span className="label">Status</span><select className="input min-h-9 py-1.5 text-xs capitalize" name="status" defaultValue={selectedVisit.status} key={`${selectedVisit.id}-${selectedVisit.status}`} disabled={!canEdit}><option value="tentative">Tentative</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
                <label className="block"><span className="label">Notes</span><textarea className="input min-h-20 py-2 text-xs" name="notes" defaultValue={selectedVisit.notes ?? ""} placeholder="Parking, access or meeting notes" maxLength={2000} disabled={!canEdit} /></label>
                <button className="button-primary min-h-9 w-full py-1.5 text-xs" type="submit" disabled={!canEdit || pending}><Check className="size-3.5" /> Save details</button>
              </form>
              <div className="flex items-center justify-between border-t border-[#e7edea] px-3 py-2">
                <div className="flex gap-1">
                  <a href={googleMapsSearchUrl(anchorFacility)} target="_blank" rel="noreferrer" className="icon-button size-8" aria-label="Open in Google Maps"><MapPin className="size-3.5" /></a>
                  <Link href={accountHref(anchorFacility)} className="icon-button size-8" aria-label="Open CRM account"><Building2 className="size-3.5" /></Link>
                  {selectedVisit.contactId && anchorFacility.contacts.find((contact) => contact.id === selectedVisit.contactId)?.phone ? <a href={`tel:${anchorFacility.contacts.find((contact) => contact.id === selectedVisit.contactId)?.phone}`} className="icon-button size-8" aria-label="Call contact"><Phone className="size-3.5" /></a> : null}
                </div>
                {canEdit ? confirmRemoveVisitId === selectedVisit.id ? <div className="flex items-center gap-1.5"><span className="text-[11px] font-semibold text-rose-800">Remove visit?</span><button type="button" className="rounded bg-rose-700 px-2 py-1 text-[11px] font-bold text-white" onClick={() => run(() => deleteFieldVisit(selectedVisit.id), () => { setSelectedVisitId(null); setConfirmRemoveVisitId(null); }, "Visit removed.")}>Yes, remove</button><button type="button" className="rounded px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setConfirmRemoveVisitId(null)}>Keep</button></div> : <button type="button" className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50" onClick={() => setConfirmRemoveVisitId(selectedVisit.id)}><Trash2 className="size-3.5" /> Remove</button> : null}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="card overflow-hidden md:hidden" aria-label="Mobile field planner">
          <div className="grid grid-cols-5 border-b border-[#dce6e1] bg-[#f7faf8]">
            {days.map((day) => (
              <button key={day} type="button" onClick={() => setMobileDay(day)} className={`min-h-12 border-r border-[#dce6e1] px-1 py-2 text-center last:border-r-0 ${mobileDay === day ? "bg-[#e7faf2] text-[#173f30]" : "text-[#64726c]"}`} aria-pressed={mobileDay === day}>
                <span className="block text-[9px] font-bold uppercase tracking-wide">{formatPlannerDate(day, { weekday: "short" })}</span>
                <span className="mt-0.5 block text-xs font-semibold">{formatPlannerDate(day, { day: "numeric" })}</span>
              </button>
            ))}
          </div>
          <div className="max-h-[55vh] divide-y divide-[#e7edea] overflow-y-auto">
            {timeSlots.map(({ hour, minute }) => {
              const slot = { date: mobileDay, hour, minute };
              const slotVisits = visits.filter((visit) => { const parts = sydneyVisitParts(visit.startsAt); return parts.date === mobileDay && parts.hour === hour && parts.minute === minute; });
              const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
              return (
                <div key={time} className="grid min-h-12 grid-cols-[58px_minmax(0,1fr)]">
                  <div className="border-r border-[#dce6e1] px-2 py-3 text-right font-mono text-[10px] font-semibold text-[#6e7d76]">{time}</div>
                  <div className="space-y-1 p-1.5">
                    {slotVisits.map((visit) => {
                      const facility = facilitiesById.get(visit.facilityId);
                      if (!facility) return null;
                      return <button key={visit.id} type="button" onClick={() => { setSelectedVisitId(visit.id); setSelectedFacilityId(facility.id); }} className={`flex min-h-9 w-full items-center gap-2 rounded border px-2 text-left text-xs font-semibold ${statusStyles[visit.status]} ${selectedVisitId === visit.id ? "ring-2 ring-[#2f7a58]" : ""}`} title={`${visit.title} · ${facility.name}`}><span className="min-w-0 flex-1 truncate">{visit.title}</span><span className="shrink-0 capitalize opacity-70">{visit.status}</span></button>;
                    })}
                    {!slotVisits.length ? <button type="button" disabled={!canEdit} onClick={() => openComposer(slot)} className="min-h-9 w-full rounded border border-dashed border-[#cfded7] text-xs font-semibold text-[#557067] disabled:cursor-default disabled:text-[#899790]">{canEdit ? "+ Add visit" : "Available"}</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="planner-grid" className="card hidden overflow-x-auto md:block" aria-label="Week field planner">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[58px_repeat(5,minmax(0,1fr))] border-b border-[#dce6e1] bg-[#f7faf8]">
              <div className="flex items-center justify-center border-r border-[#dce6e1] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7b8c84]">Time</div>
              {days.map((day) => <div key={day} className="border-r border-[#dce6e1] px-2 py-2 text-center last:border-r-0"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2f7a58]">{formatPlannerDate(day, { weekday: "short" })}</span><span className="ml-1.5 text-xs font-semibold text-[#1f352c]">{formatPlannerDate(day, { day: "numeric", month: "short" })}</span></div>)}
            </div>
            {timeSlots.map(({ hour, minute }) => (
              <div key={`${hour}-${minute}`} className={`grid h-[clamp(18px,calc((100vh-340px)/20),28px)] grid-cols-[58px_repeat(5,minmax(0,1fr))] ${minute === 0 ? "border-t border-[#d8e2dd]" : "border-t border-dashed border-[#edf1ef]"}`}>
                <div className="relative border-r border-[#dce6e1] pr-2 text-right font-mono text-[10px] font-semibold text-[#6e7d76]">{minute === 0 ? <span className="relative -top-2">{String(hour).padStart(2, "0")}:00</span> : null}</div>
                {days.map((day) => {
                  const slotVisits = visits.filter((visit) => { const parts = sydneyVisitParts(visit.startsAt); return parts.date === day && parts.hour === hour && parts.minute === minute; });
                  const slot = { date: day, hour, minute };
                  return (
                    <div key={`${day}-${hour}-${minute}`} data-testid={`planner-slot-${day}-${String(hour).padStart(2, "0")}-${String(minute).padStart(2, "0")}`} role="button" tabIndex={canEdit ? 0 : -1} aria-disabled={!canEdit} aria-label={canEdit ? `Schedule a visit ${slotLabel(slot)}` : `${slotLabel(slot)}, view only`} onDragOver={(event) => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => handleDrop(event, slot)} onClick={() => openComposer(slot)} onKeyDown={(event) => { if (canEdit && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openComposer(slot); } }} className={`group/slot relative min-w-0 border-r border-[#e1e9e5] px-1 last:border-r-0 focus-visible:z-10 ${canEdit ? "hover:bg-[#f0f8f4]" : "cursor-default"}`}>
                      {!slotVisits.length ? <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 text-center text-[10px] font-medium text-transparent group-hover/slot:text-[#789087]">+ Add</span> : null}
                      <div className="relative z-[1] flex h-full gap-1 py-0.5">
                        {slotVisits.map((visit) => {
                          const facility = facilitiesById.get(visit.facilityId);
                          if (!facility) return null;
                          const selected = selectedVisitId === visit.id;
                          const start = sydneyVisitParts(visit.startsAt).time;
                          return <article key={visit.id} data-testid={`visit-card-${visit.id}`} draggable={canEdit} onDragStart={(event) => dragPayload(event, { type: "visit", id: visit.id })} onClick={(event) => { event.stopPropagation(); setSelectedVisitId(visit.id); setSelectedFacilityId(facility.id); }} className={`flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded border px-1.5 text-[10px] font-semibold shadow-sm ${statusStyles[visit.status]} ${selected ? "ring-2 ring-[#2f7a58]" : "hover:brightness-[0.98]"}`} title={`${visit.title} · ${facility.name} · ${start} · ${visit.status}`}><span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" /><span className="truncate">{visit.title}</span><span className="ml-auto shrink-0 font-mono text-[9px] opacity-70">{start}</span></article>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="grid grid-cols-[58px_repeat(5,minmax(0,1fr))] border-t border-[#d8e2dd]">
              <div className="relative h-2 border-r border-[#dce6e1]"><span className="absolute -top-2.5 right-2 font-mono text-[10px] font-semibold text-[#6e7d76]">18:00</span></div>
              {days.map((day) => <div key={day} className="h-2 border-r border-[#e1e9e5] last:border-r-0" />)}
            </div>
          </div>
        </section>
      </div>

      {composerSlot ? (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <section className="pointer-events-auto w-full max-w-[480px] overflow-hidden rounded-[10px] border border-[#b9ccc2] bg-white shadow-2xl" role="dialog" aria-modal="false" aria-labelledby="visit-composer-title">
            <div className="flex items-start justify-between border-b border-[#dce6e1] bg-[#f7faf8] px-5 py-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2f7a58]">New field visit</p><h2 id="visit-composer-title" className="mt-1 text-base font-semibold text-[#1f352c]">{slotLabel(composerSlot)}</h2></div>
              <button type="button" onClick={() => setComposerSlot(null)} className="icon-button size-8" aria-label="Close visit composer"><X className="size-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="slot-facility-search" className="label">Facility</label>
                {composerFacility ? (
                  <div className="flex items-center gap-3 rounded-[7px] border border-[#a9cbbb] bg-[#f3fbf7] p-3"><Building2 className="size-4 shrink-0 text-[#2f7a58]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1f352c]">{composerFacility.name}</p><p className="truncate text-xs text-[#64726c]">{composerFacility.suburb} · {composerFacility.providerName}</p></div><button type="button" onClick={() => setComposerFacilityId(null)} className="text-xs font-semibold text-[#1f6548] hover:underline">Change</button></div>
                ) : (
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#64726c]" /><input id="slot-facility-search" autoFocus className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, provider, suburb or postcode" autoComplete="off" />{query.trim() ? <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-[7px] border border-[#cbd9d2] bg-white py-1 shadow-xl">{searchResults.map((facility) => <button key={facility.id} type="button" onClick={() => chooseFacility(facility)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[#f0f8f4]"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[#ff8059]" /><span className="min-w-0"><span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#1f352c]"><span className="rounded bg-[#e7faf2] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#246348]">Facility</span>{facility.name}</span><span className="block truncate text-xs text-[#64726c]"><span className="font-semibold text-[#4f6259]">Provider:</span> {facility.providerName} · {facility.suburb}</span></span></button>)}{!searchResults.length ? <p className="px-3 py-5 text-center text-sm text-[#64726c]">No facilities match “{query.trim()}”. Try a provider, suburb, postcode or facility name.</p> : null}</div> : null}</div>
                )}
              </div>
              {composerFacility ? <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="slot-contact" className="text-xs font-semibold text-[#4f6259]">Contact <span className="font-normal text-[#7b8c84]">(optional)</span></label><button type="button" onClick={() => setShowNewContact((current) => !current)} className="inline-flex items-center gap-1 text-xs font-bold text-[#1f6548] hover:underline"><Plus className="size-3.5" /> Add contact</button></div><select id="slot-contact" className="input" value={composerContactId} onChange={(event) => setComposerContactId(event.target.value)}><option value="">No contact assigned</option>{composerContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.title ? ` · ${contact.title}` : ""}{contact.phone ? ` · ${contact.phone}` : ""}</option>)}</select></div> : null}
              {composerFacility ? <label className="block"><span className="label">Visit title</span><input className="input" value={composerTitle} onChange={(event) => setComposerTitle(event.target.value)} placeholder="Purpose of the visit" maxLength={200} required /></label> : null}
              {composerFacility && showNewContact ? <div className="space-y-3 rounded-[8px] border border-[#d7eee3] bg-[#f7fbf9] p-3.5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2f7a58]">New CRM contact</p><button type="button" onClick={() => setShowNewContact(false)} className="text-[#64726c]" aria-label="Cancel adding contact"><X className="size-4" /></button></div><input className="input" value={newContactName} onChange={(event) => setNewContactName(event.target.value)} placeholder="Full name *" autoFocus /><div className="grid grid-cols-2 gap-2"><input className="input" value={newContactTitle} onChange={(event) => setNewContactTitle(event.target.value)} placeholder="Role or title" /><input className="input" value={newContactPhone} onChange={(event) => setNewContactPhone(event.target.value)} placeholder="Phone" /></div><button type="button" onClick={saveNewContact} disabled={!newContactName.trim() || pending} className="button-secondary min-h-9 w-full py-1.5 text-xs"><UserRound className="size-3.5" /> Save and select contact</button></div> : null}
            </div>
            <div className="flex items-center justify-between border-t border-[#dce6e1] bg-[#fbfcfb] px-5 py-3">
              <p className="text-xs text-[#64726c]">30-minute visit · Sydney time</p>
              <div className="flex gap-2"><button type="button" onClick={() => setComposerSlot(null)} className="button-secondary min-h-9 px-3 py-1.5 text-xs">Cancel</button><button type="button" disabled={!composerFacility || !composerTitle.trim() || pending} onClick={() => { if (!composerFacility || !composerTitle.trim()) return; run(() => scheduleFieldVisit(composerFacility.id, localPlannerSlot(composerSlot.date, composerSlot.hour, composerSlot.minute), composerTitle, composerContactId || null), () => setComposerSlot(null), "Tentative visit scheduled."); }} className="button-primary min-h-9 px-3 py-1.5 text-xs"><CalendarPlus className="size-3.5" /> Schedule tentative visit</button></div>
            </div>
          </section>
        </div>
      ) : null}
      {pending ? <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[#0f3f2f] px-4 py-2.5 text-sm font-semibold text-white shadow-xl"><LoaderCircle className="size-4 animate-spin" /> Saving…</div> : null}
    </div>
  );
}
