import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  recordBelongsToVisibleAccount,
  recordModeForProvider,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --experimental-strip-types --test`
} from "../../../src/features/accounts/server/provider-record-mode.ts";

const sampleProviders = new Set(["sample-provider"]);

test("provider mode is derived from the sample boundary", () => {
  assert.equal(recordModeForProvider(false), "real");
  assert.equal(recordModeForProvider(true), "sandbox");
});

test("top-level lists show real accounts and the durable sample only", () => {
  assert.equal(recordBelongsToVisibleAccount("real", "real-provider", sampleProviders), true);
  assert.equal(recordBelongsToVisibleAccount("sandbox", "sample-provider", sampleProviders), true);
  assert.equal(recordBelongsToVisibleAccount("sandbox", "real-provider", sampleProviders), false);
  assert.equal(recordBelongsToVisibleAccount("real", "sample-provider", sampleProviders), false);
  assert.equal(recordBelongsToVisibleAccount(null, "sample-provider", sampleProviders), true);
});

test("operational lists apply the shared account-visibility rule", () => {
  for (const path of [
    "src/app/(app)/pipeline/page.tsx",
    "src/app/(app)/tasks/page.tsx",
    "src/app/(app)/customers/page.tsx",
    "src/app/(app)/search/page.tsx",
  ]) {
    const page = readFileSync(path, "utf8");
    assert.match(page, /recordBelongsToVisibleAccount/);
    assert.match(page, /loadSampleProviderIds/);
  }
});

test("view-local summaries use the same visible records as their lists", () => {
  const pipeline = readFileSync("src/app/(app)/pipeline/page.tsx", "utf8");
  const customers = readFileSync("src/app/(app)/customers/page.tsx", "utf8");
  assert.doesNotMatch(pipeline, /realOpportunities/);
  assert.doesNotMatch(customers, /realCustomers/);
});
