import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalProviderWorkspaceHash,
  legacyProviderHashTarget,
  parseProviderWorkspaceTab,
  providerWorkspaceTabHref,
  resolveProviderWorkspaceLocation,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/accounts/lib/provider-workspace-tabs.ts";

test("accepts only the five workspace tabs and defaults everything else", () => {
  for (const tab of ["overview", "people", "intelligence", "commercial", "evidence"]) {
    assert.equal(parseProviderWorkspaceTab(tab), tab);
  }
  assert.equal(parseProviderWorkspaceTab(undefined), "overview");
  assert.equal(parseProviderWorkspaceTab("contacts"), "overview");
  assert.equal(parseProviderWorkspaceTab(["people", "commercial"]), "overview");
});

test("builds explicit tab links with selected facility and validated return origin", () => {
  assert.equal(
    providerWorkspaceTabHref("provider-1", "people", "facility-1"),
    "/providers/provider-1?tab=people&facility=facility-1",
  );
  assert.equal(
    providerWorkspaceTabHref(
      "provider/1",
      "evidence",
      "facility-1",
      undefined,
      "/pipeline?stage=qualified#board",
    ),
    "/providers/provider%2F1?tab=evidence&facility=facility-1&returnTo=%2Fpipeline%3Fstage%3Dqualified%23board",
  );
});

test("maps legacy section and object hashes to safe tabs", () => {
  assert.equal(legacyProviderHashTarget("#contacts"), "people");
  assert.equal(legacyProviderHashTarget("#contact-abc"), "people");
  assert.equal(legacyProviderHashTarget("#facility-00000000-0000-0000-0000-000000000001"), "overview");
  assert.equal(legacyProviderHashTarget("#account-intelligence"), "intelligence");
  assert.equal(legacyProviderHashTarget("#activity"), "commercial");
  assert.equal(legacyProviderHashTarget("#provenance"), "evidence");
  assert.equal(legacyProviderHashTarget("#unknown"), null);
});

test("makes missing, invalid, and duplicate tabs explicit", () => {
  assert.deepEqual(
    resolveProviderWorkspaceLocation("facility=facility-1", ""),
    {
      tab: "overview",
      search: "facility=facility-1&tab=overview",
      hash: "",
      anchorId: null,
      needsReplace: true,
    },
  );
  assert.equal(
    resolveProviderWorkspaceLocation("tab=contacts", "").search,
    "tab=overview",
  );
  assert.equal(
    resolveProviderWorkspaceLocation("tab=people&tab=commercial", "").search,
    "tab=overview",
  );
  assert.equal(
    resolveProviderWorkspaceLocation("tab=evidence", "").needsReplace,
    false,
  );
});

test("infers a selected facility even when the legacy hash already matches the tab", () => {
  const facilityId = "00000000-0000-4000-8000-000000000001";
  assert.deepEqual(
    resolveProviderWorkspaceLocation(
      "?tab=overview&notice=Saved",
      `#facility-${facilityId}`,
    ),
    {
      tab: "overview",
      search: `tab=overview&notice=Saved&facility=${facilityId}`,
      hash: `#facility-${facilityId}`,
      anchorId: `facility-${facilityId}`,
      needsReplace: true,
    },
  );
});

test("does not infer malformed facility hashes or replace an explicit selection", () => {
  assert.equal(
    resolveProviderWorkspaceLocation(
      "tab=overview",
      "#facility-------------------------------------",
    ).search,
    "tab=overview",
  );
  assert.equal(
    resolveProviderWorkspaceLocation(
      "tab=overview&facility=chosen-facility",
      "#facility-00000000-0000-4000-8000-000000000001",
    ).search,
    "tab=overview&facility=chosen-facility",
  );
});

test("preserves query context while a legacy anchor selects its owning tab", () => {
  const resolution = resolveProviderWorkspaceLocation(
    "tab=overview&facility=facility-1&returnTo=%2Fpipeline%3Fstage%3Dqualified%23board&notice=Saved",
    "#activity",
  );
  assert.deepEqual(resolution, {
    tab: "commercial",
    search: "tab=commercial&facility=facility-1&returnTo=%2Fpipeline%3Fstage%3Dqualified%23board&notice=Saved",
    hash: "#activity",
    anchorId: "activity",
    needsReplace: true,
  });

  assert.equal(
    resolveProviderWorkspaceLocation(resolution.search, resolution.hash).needsReplace,
    false,
  );
});

test("canonicalizes only the dead selected-facility fragment", () => {
  assert.equal(canonicalProviderWorkspaceHash("#selected-facility"), "#overview");
  assert.equal(canonicalProviderWorkspaceHash("#facilities"), "#facilities");
  assert.deepEqual(
    resolveProviderWorkspaceLocation("tab=people&facility=facility-1", "#selected-facility"),
    {
      tab: "overview",
      search: "tab=overview&facility=facility-1",
      hash: "#overview",
      anchorId: "overview",
      needsReplace: true,
    },
  );
  assert.deepEqual(
    resolveProviderWorkspaceLocation("tab=overview", "#facilities"),
    {
      tab: "overview",
      search: "tab=overview",
      hash: "#facilities",
      anchorId: "facilities",
      needsReplace: false,
    },
  );
});
