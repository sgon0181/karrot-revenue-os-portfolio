import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function lineCount(path: string) {
  return source(path).split("\n").length;
}

test("provider workspace owns five explicit panels and keeps routes free of data queries", () => {
  const panels = [
    "overview-panel.tsx",
    "people-panel.tsx",
    "intelligence-panel.tsx",
    "commercial-panel.tsx",
    "evidence-panel.tsx",
  ];
  for (const panel of panels) {
    const path = `src/features/accounts/components/${panel}`;
    assert.ok(lineCount(path) < 500, `${panel} should remain a bounded module`);
    assert.doesNotMatch(source(path), /createClient\(|\.from\(/);
  }
  assert.ok(
    lineCount("src/features/accounts/components/provider-workspace.tsx") < 400,
  );
  assert.doesNotMatch(
    source("src/features/accounts/components/provider-workspace.tsx"),
    /createClient\(|\.from\(/,
  );
});

test("intelligence domain types, review controls, cards, briefs and history stay separated", () => {
  const modules = [
    "src/features/intelligence/lib/types.ts",
    "src/features/intelligence/lib/claims.ts",
    "src/features/intelligence/components/claim-review-controls.tsx",
    "src/features/intelligence/components/claim-card.tsx",
    "src/features/intelligence/components/brief-sections.tsx",
    "src/features/intelligence/components/research-history.tsx",
    "src/features/intelligence/components/research-status-controls.tsx",
  ];
  for (const path of modules) {
    assert.ok(lineCount(path) < 250, `${path} should remain a focused module`);
  }
  assert.ok(
    lineCount("src/features/intelligence/components/account-intelligence.tsx") <
      700,
  );
  assert.doesNotMatch(
    source("src/features/accounts/server/load-research-memory.ts"),
    /components\/account-intelligence/,
  );
});
