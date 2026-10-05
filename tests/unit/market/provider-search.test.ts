import assert from "node:assert/strict";
import test from "node:test";
import {
  facilityVisibleIdentityMatchesSearch,
  normalizedProviderPage,
  providerFacilitySearchFilters,
  providerIdentityMatchesSearch,
  providerResearchDirectoryStatus,
  providerSearchPattern,
  providerWorkspaceHref,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --experimental-strip-types --test`
} from "../../../src/features/market/lib/provider-search.ts";

test("normalizes invalid and out-of-range provider pages", () => {
  assert.deepEqual(normalizedProviderPage("2", 7), { page: 1, pageCount: 1 });
  assert.deepEqual(normalizedProviderPage("2", 237), { page: 2, pageCount: 5 });
  assert.deepEqual(normalizedProviderPage("not-a-page", 237), { page: 1, pageCount: 5 });
  assert.deepEqual(normalizedProviderPage("-4", 0), { page: 1, pageCount: 1 });
});

test("creates literal, wildcard-separated search patterns", () => {
  assert.equal(providerSearchPattern(" Milford, House_* "), "Milford%House");
});

test("distinguishes provider identity matches from facility-only matches", () => {
  const provider = {
    business_name: "The Sir Moses Montefiore Jewish Home",
    entity_name: "THE SIR MOSES MONTEFIORE JEWISH HOME",
    abn: "55390901239",
  };
  assert.equal(providerIdentityMatchesSearch(provider, "Montefiore"), true);
  assert.equal(providerIdentityMatchesSearch(provider, "Randwick"), false);
});

test("sample facility matching ignores hidden synthetic source identifiers", () => {
  const facility = {
    name: "Sample Queens Uncle Ben House",
    suburb: "Sydney",
    postcode: "2000",
    full_address: "Bennelong Point, Sydney NSW 2000",
    location_label: "Sydney Opera House Attic",
  };
  assert.equal(facilityVisibleIdentityMatchesSearch(facility, "Oscorp"), false);
  assert.equal(facilityVisibleIdentityMatchesSearch(facility, "Opera House"), true);
});

test("provider facility lookup covers the visible location label", () => {
  assert.deepEqual(providerFacilitySearchFilters("Opera%House"), [
    "name.ilike.%Opera%House%",
    "suburb.ilike.%Opera%House%",
    "postcode.ilike.%Opera%House%",
    "full_address.ilike.%Opera%House%",
    "acqsc_site_id.ilike.%Opera%House%",
    "location_label.ilike.%Opera%House%",
  ]);
});

test("builds focused facility workspace links", () => {
  assert.equal(providerWorkspaceHref("provider-1"), "/providers/provider-1?tab=overview");
  assert.equal(
    providerWorkspaceHref("provider-1", "facility-1"),
    "/providers/provider-1?tab=overview&facility=facility-1#facility-facility-1",
  );
});

test("presents provider research lifecycle as clear directory actions", () => {
  assert.deepEqual(providerResearchDirectoryStatus("never_researched"), {
    label: "Research available",
    tone: "blue",
  });
  assert.deepEqual(providerResearchDirectoryStatus("fresh"), {
    label: "Researched",
    tone: "green",
  });
  assert.deepEqual(providerResearchDirectoryStatus("aging"), {
    label: "Update available",
    tone: "amber",
  });
  assert.deepEqual(providerResearchDirectoryStatus("stale"), {
    label: "Update available",
    tone: "amber",
  });
  assert.deepEqual(providerResearchDirectoryStatus("researching"), {
    label: "Research in progress",
    tone: "blue",
  });
  assert.deepEqual(providerResearchDirectoryStatus("failed"), {
    label: "Research failed",
    tone: "red",
  });
  assert.deepEqual(providerResearchDirectoryStatus("never_researched", false), {
    label: "Research unavailable",
    tone: "slate",
  });
});
