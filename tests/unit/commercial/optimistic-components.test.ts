import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("Pipeline Move is a focused optimistic client island with recovery feedback", () => {
  const page = source("src/app/(app)/pipeline/page.tsx");
  const board = source("src/features/commercial/components/pipeline-board.tsx");

  assert.match(page, /<PipelineBoard stages=\{boardStages\} opportunities=\{opportunities\} canEdit=\{canEdit\} \/>/);
  assert.match(board, /^"use client";/);
  assert.match(board, /useActionState\(/);
  assert.match(board, /useOptimistic</);
  assert.match(board, /moveOpportunityOptimistically/);
  assert.match(board, /moveOpportunityStageInline\(previousState, formData\)/);
  assert.match(board, /name="expected_stage_id" value=\{opportunity\.stage_id\}/);
  assert.match(board, /disabled=\{disabled \|\| !canEdit\}/);
  assert.match(
    board,
    /<form action=\{action\} aria-busy=\{pending\} className="relative mt-3/,
    "the move form must anchor its sr-only label inside the horizontally scrolling board",
  );
  assert.match(board, /pending=\{movePending && activeMoveId === opportunity\.id\}/);
  assert.match(board, /state=\{moveState\}/);
  assert.match(board, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
  assert.match(board, /focus\(\{ preventScroll: true \}\)/);
  assert.match(board, /aria-live="polite"/);
  assert.match(board, /feedback\.status === "error"/);
  assert.doesNotMatch(board, /updateOpportunityStage\b/);
});

test("Tasks Complete updates one row in place and keeps Reschedule redirect-based", () => {
  const page = source("src/app/(app)/tasks/page.tsx");
  const row = source("src/features/commercial/components/task-row.tsx");
  const boundary = source("src/features/commercial/components/task-completion-boundary.tsx");

  assert.match(page, /<TaskRow key=\{task\.id\} task=\{task\} sectionKey=\{section\.key\} origin=\{origin\} \/>/);
  assert.match(page, /<TaskCompletionBoundary>/);
  assert.match(row, /^"use client";/);
  assert.match(row, /useActionState\(/);
  assert.match(row, /useOptimistic<TaskListItem, string>/);
  assert.match(row, /completeTaskOptimistically/);
  assert.match(row, /completeNextActionInline\(previousState, formData\)/);
  assert.match(row, /useTaskCompletionFeedback\(\)/);
  assert.match(row, /disabled=\{pending\}/);
  assert.match(row, /<fieldset disabled=\{pending\}/);
  assert.match(row, /state\.status === "error"/);
  assert.match(row, /<form action=\{rescheduleNextAction\}/);
  assert.doesNotMatch(row, /completeNextAction\b/);
  assert.match(boundary, /aria-live="polite"/);
  assert.match(boundary, /document\.activeElement === document\.body/);
  assert.match(boundary, /aria-current="page"/);
});

test("inline action module returns state and never constructs client-directed return URLs", () => {
  const actions = source("src/features/commercial/server/inline-actions.ts");

  assert.match(actions, /^"use server";/);
  assert.match(actions, /getAuthenticatedPrincipal\(\)/);
  assert.doesNotMatch(actions, /auth\.getUser\(/);
  assert.doesNotMatch(actions, /from "next\/navigation"/);
  assert.doesNotMatch(actions, /redirect\(/);
  assert.doesNotMatch(actions, /return_to/);
});
