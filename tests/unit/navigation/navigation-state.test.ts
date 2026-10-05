import assert from "node:assert/strict";
import test from "node:test";
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
import { isNavigationItemActive } from "../../../src/shared/lib/navigation-state.ts";

test("matches exact, nested, and related navigation paths", () => {
  assert.equal(isNavigationItemActive("/pipeline", "/pipeline"), true);
  assert.equal(isNavigationItemActive("/opportunities/opp-1", "/pipeline", ["/opportunities"]), true);
  assert.equal(isNavigationItemActive("/search", "/providers", ["/search"]), true);
  assert.equal(isNavigationItemActive("/providers/provider-1", "/providers"), true);
});

test("does not match lookalike or unrelated paths", () => {
  assert.equal(isNavigationItemActive("/pipeline-report", "/pipeline"), false);
  assert.equal(isNavigationItemActive("/customers", "/pipeline", ["/opportunities"]), false);
});
