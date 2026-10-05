const SYDNEY_TIME_ZONE = "Australia/Sydney";

export const PLANNER_START_HOUR = 8;
export const PLANNER_END_HOUR = 18;
export const PLANNER_SLOT_MINUTES = 30;

export type PlannerContact = {
  id: string;
  facilityId: string | null;
  fullName: string;
  title: string | null;
  phone: string | null;
};

export type PlannerFacility = {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  address: string;
  suburb: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  isSample: boolean;
  contacts: PlannerContact[];
};

export type PlannerVisit = {
  id: string;
  title: string;
  facilityId: string;
  contactId: string | null;
  startsAt: string;
  endsAt: string;
  status: "tentative" | "confirmed" | "completed" | "cancelled";
  notes: string | null;
  recordMode: "real" | "sandbox";
};

export function sharesPlannerBoundary(
  anchor: Pick<PlannerFacility, "isSample">,
  candidate: Pick<PlannerFacility, "isSample">,
) {
  return anchor.isSample === candidate.isSample;
}

export function googleMapsSearchUrl(facility: Pick<PlannerFacility, "name" | "address" | "latitude" | "longitude">) {
  const query = facility.latitude !== null && facility.longitude !== null
    ? `${facility.latitude},${facility.longitude}`
    : `${facility.name}, ${facility.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function haversineDistanceKm(origin: PlannerFacility, destination: PlannerFacility) {
  if (
    origin.latitude === null
    || origin.longitude === null
    || destination.latitude === null
    || destination.longitude === null
  ) return null;

  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const originLatitude = radians(origin.latitude);
  const destinationLatitude = radians(destination.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mondayForSydneyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dateOnly = `${values.year}-${values.month}-${values.day}`;
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(values.weekday);
  return addDays(dateOnly, -Math.max(weekdayIndex, 0));
}

export function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isMonday(dateOnly: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return !Number.isNaN(date.valueOf())
    && date.toISOString().slice(0, 10) === dateOnly
    && date.getUTCDay() === 1;
}

export function formatPlannerDate(dateOnly: string, options?: Intl.DateTimeFormatOptions) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function localPlannerSlot(dateOnly: string, hour: number, minute = 0) {
  return `${dateOnly}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidPlannerSlot(localDateTime: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) return false;
  const [, dateOnly, hourText, minuteText] = match;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return date.toISOString().slice(0, 10) === dateOnly
    && date.getUTCDay() >= 1
    && date.getUTCDay() <= 5
    && hour >= PLANNER_START_HOUR
    && hour < PLANNER_END_HOUR
    && minute >= 0
    && minute < 60
    && minute % PLANNER_SLOT_MINUTES === 0;
}

export function facilityMatchesQuery(facility: PlannerFacility, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return false;
  return `${facility.name} ${facility.providerName} ${facility.address} ${facility.suburb} ${facility.postcode}`
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

export function sydneyVisitParts(isoValue: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoValue));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}
