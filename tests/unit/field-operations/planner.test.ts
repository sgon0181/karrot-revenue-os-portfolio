import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  facilityMatchesQuery,
  googleMapsSearchUrl,
  isMonday,
  isValidPlannerSlot,
  sharesPlannerBoundary,
  type PlannerFacility,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --experimental-strip-types --test`
} from "../../../src/features/visits/lib/planner.ts";

const facility: PlannerFacility = {
  id: "facility-1",
  providerId: "provider-1",
  providerName: "Montefiore",
  name: "Randwick Montefiore Home",
  address: "36 Dangar Street, Randwick NSW 2031",
  suburb: "Randwick",
  postcode: "2031",
  latitude: -33.914,
  longitude: 151.24,
  isSample: false,
  contacts: [],
};

test("planner accepts only valid weekday half-hour slots", () => {
  assert.equal(isValidPlannerSlot("2026-08-24T08:00"), true);
  assert.equal(isValidPlannerSlot("2026-08-28T17:30"), true);
  assert.equal(isValidPlannerSlot("2026-08-29T10:00"), false);
  assert.equal(isValidPlannerSlot("2026-08-24T07:30"), false);
  assert.equal(isValidPlannerSlot("2026-08-24T18:00"), false);
  assert.equal(isValidPlannerSlot("2026-08-24T09:15"), false);
  assert.equal(isValidPlannerSlot("2026-08-24T08:60"), false);
  assert.equal(isValidPlannerSlot("2026-02-30T10:00"), false);
});

test("week navigation accepts real Mondays only", () => {
  assert.equal(isMonday("2026-08-24"), true);
  assert.equal(isMonday("2026-08-25"), false);
  assert.equal(isMonday("2026-02-30"), false);
  assert.equal(isMonday("not-a-date"), false);
});

test("facility search covers facility and provider identity plus location", () => {
  assert.equal(facilityMatchesQuery(facility, "randwick montefiore"), true);
  assert.equal(facilityMatchesQuery(facility, "Montefiore"), true);
  assert.equal(facilityMatchesQuery(facility, "Dangar"), true);
  assert.equal(facilityMatchesQuery(facility, "2031"), true);
  assert.equal(facilityMatchesQuery(facility, "BaptistCare"), false);
  assert.equal(facilityMatchesQuery(facility, "   "), false);
});

test("maps links prefer source-backed coordinates", () => {
  const url = new URL(googleMapsSearchUrl(facility));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("query"), "-33.914,151.24");
});

test("nearby planning never crosses the sample boundary", () => {
  assert.equal(sharesPlannerBoundary(facility, { isSample: false }), true);
  assert.equal(sharesPlannerBoundary(facility, { isSample: true }), false);
  assert.equal(sharesPlannerBoundary({ isSample: true }, { isSample: true }), true);
});

test("planner mutations isolate overlap and contact checks by account mode", () => {
  const actions = readFileSync(
    new URL("../../../src/features/visits/server/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /\.eq\("record_mode", recordMode\)/);
  assert.match(actions, /\.eq\("record_mode", facility\.is_sample \? "sandbox" : "real"\)/);
});
