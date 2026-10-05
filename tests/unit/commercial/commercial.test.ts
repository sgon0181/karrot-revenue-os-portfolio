import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  classifyDueDate,
  opportunityHref,
  stageTransitionGuidance,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --test`
} from "../../../src/features/commercial/lib/commercial.ts";
import {
  completeTaskOptimistically,
  moveOpportunityOptimistically,
// Node's built-in type stripping requires the extension; the production
// TypeScript configuration intentionally does not enable TS extension imports.
// @ts-expect-error exercised directly with `node --test`
} from "../../../src/features/commercial/lib/optimistic-interactions.ts";

test("Sydney due-state classification keeps unscheduled, overdue, today and upcoming distinct", () => {
  const now = new Date("2026-08-24T02:00:00.000Z");
  assert.equal(classifyDueDate(null, now), "unscheduled");
  assert.equal(classifyDueDate("2026-08-23T23:00:00+10:00", now), "overdue");
  assert.equal(classifyDueDate("2026-08-24T17:00:00+10:00", now), "today");
  assert.equal(classifyDueDate("2026-08-25T09:00:00+10:00", now), "upcoming");
});

test("task destinations open the owning commercial context", () => {
  assert.equal(opportunityHref("opportunity-1", "provider-1"), "/opportunities/opportunity-1");
  assert.equal(opportunityHref(null, "provider-1"), "/providers/provider-1?tab=commercial");
});

test("Closed Lost requires a reason and explains the terminal transition", () => {
  const guidance = stageTransitionGuidance({ selectedOutcome: "lost", currentOutcome: null, hasCustomer: false });
  assert.equal(guidance.requiresLossReason, true);
  assert.equal(guidance.tone, "lost");
  assert.match(guidance.message ?? "", /reason remains visible/i);
});

test("Closed Won explains customer creation without mixing record modes", () => {
  const guidance = stageTransitionGuidance({ selectedOutcome: "won", currentOutcome: null, hasCustomer: false });
  assert.equal(guidance.requiresLossReason, false);
  assert.equal(guidance.tone, "won");
  assert.match(guidance.message ?? "", /new customer relationship/i);
  assert.match(guidance.message ?? "", /new customer relationship/i);
  assert.doesNotMatch(guidance.message ?? "", /record mode/i);
});

test("reopening a won opportunity preserves customer continuity", () => {
  const guidance = stageTransitionGuidance({ selectedOutcome: null, currentOutcome: "won", hasCustomer: true });
  assert.equal(guidance.tone, "reopen");
  assert.match(guidance.message ?? "", /does not remove/i);
});

test("pipeline optimism moves only the selected card without mutating server props", () => {
  const original = [
    { id: "opportunity-a", stage_id: "discovery", name: "A" },
    { id: "opportunity-b", stage_id: "qualified", name: "B" },
  ];
  const moved = moveOpportunityOptimistically(original, {
    opportunityId: "opportunity-a",
    stageId: "qualified",
  });

  assert.deepEqual(moved.map(({ id, stage_id }) => ({ id, stage_id })), [
    { id: "opportunity-a", stage_id: "qualified" },
    { id: "opportunity-b", stage_id: "qualified" },
  ]);
  assert.equal(original[0].stage_id, "discovery");
  assert.notEqual(moved[0], original[0]);
  assert.equal(moved[1], original[1]);

  const secondMove = moveOpportunityOptimistically(moved, {
    opportunityId: "opportunity-a",
    stageId: "pilot",
  });
  assert.equal(secondMove[0].stage_id, "pilot", "a later queued move wins deterministically");

  assert.equal(
    original[0].stage_id,
    "discovery",
    "discarding the optimistic value rolls the visible card back to the authoritative prop",
  );
});

test("task optimism completes in place while preserving the rollback source", () => {
  const original = { id: "task-a", status: "open", title: "Call the account" };
  const completed = completeTaskOptimistically(original, "task-a");

  assert.equal(completed.status, "completed");
  assert.equal(original.status, "open");
  assert.notEqual(completed, original);
  assert.equal(
    original.status,
    "open",
    "an error can roll the row back by rendering the unchanged authoritative prop",
  );

  const unrelated = completeTaskOptimistically(original, "task-b");
  assert.equal(unrelated, original);
});

test("optimistic action and rendered-lifecycle gates pass through the stable commercial entrypoint", () => {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--disable-warning=ExperimentalWarning",
      "--experimental-strip-types",
      "--experimental-test-module-mocks",
      "--test",
      "--test-concurrency=1",
      "tests/unit/commercial/optimistic-components.test.ts",
      "tests/unit/commercial/optimistic-inline-actions.test.ts",
      "tests/unit/commercial/pipeline-board-lifecycle.test.ts",
      "tests/unit/commercial/task-row-lifecycle.test.ts",
    ],
    { cwd: process.cwd(), encoding: "utf8", env: childEnvironment },
  );
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});
