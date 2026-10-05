import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providersPage = readFileSync("src/app/(app)/providers/page.tsx", "utf8");
const providerWorkspace = readFileSync(
  "src/features/accounts/components/provider-workspace.tsx",
  "utf8",
);
const recorder = readFileSync(
  "src/features/market/components/provider-workspace-view-recorder.tsx",
  "utf8",
);

test("the Providers default has no pinned Randwick treatment", () => {
  assert.doesNotMatch(providersPage, /Randwick field cohort/i);
  assert.doesNotMatch(providersPage, /RANDWICK_DOGFOOD/);
  assert.match(providersPage, /Recently opened accounts/);
  assert.match(providersPage, /No recently opened accounts/);
});

test("search results replace rather than compete with recent accounts", () => {
  assert.match(providersPage, /const hasActiveFilters = Boolean\(search \|\| status\)/);
  assert.match(providersPage, /!hasActiveFilters \? \(/);
  assert.match(providersPage, /hasActiveFilters \? <section className="table-shell"/);
});

test("the authoritative browse excludes samples while explicit search can find them", () => {
  assert.match(providersPage, /if \(!safeSearch\) filtered = filtered\.eq\("is_sample", false\)/);
  assert.doesNotMatch(providersPage, /Sandbox activity|Sandbox customer|Sandbox<\/Badge>/);
});

test("provider results explain current research availability", () => {
  assert.match(providersPage, /researchStatusFor/);
  assert.match(providersPage, /<th className="px-4 py-3 font-semibold">Research<\/th>/);
  assert.match(providersPage, /providerResearchDirectoryStatus/);
  assert.match(providersPage, /tab=intelligence/);
});

test("an actual mounted provider workspace records personal recency", () => {
  assert.match(providerWorkspace, /<ProviderWorkspaceViewRecorder providerId=\{id\} \/>/);
  assert.match(recorder, /useEffect\(\(\) =>/);
  assert.match(recorder, /recordProviderWorkspaceView\(providerId\)/);
});
