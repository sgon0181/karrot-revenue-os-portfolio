import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const featuresRoot = join(root, "src/features");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("Intelligence owns its three Server Actions and Accounts stays commercial", () => {
  const actions = readSource("src/features/intelligence/server/actions.ts");
  assert.match(actions, /^"use server";/);
  assert.deepEqual(
    [...actions.matchAll(/export async function (\w+)\(/g)]
      .map((match) => match[1])
      .sort(),
    ["addManualIntelligence", "researchAccount", "reviewIntelligenceClaim"],
  );

  const accountFacade = readSource("src/features/accounts/server/actions.ts");
  for (const name of [
    "addManualIntelligence",
    "researchAccount",
    "reviewIntelligenceClaim",
  ]) {
    assert.doesNotMatch(accountFacade, new RegExp(`\\b${name}\\b`));
  }
  assert.doesNotMatch(accountFacade, /actions\/intelligence/);
  assert.equal(
    existsSync(join(root, "src/features/accounts/server/actions/intelligence.ts")),
    false,
  );
});

test("Intelligence UI binds its own actions without reaching into another server feature", () => {
  const componentFiles = sourceFiles(
    join(featuresRoot, "intelligence/components"),
  );
  for (const path of componentFiles) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(
      source,
      /@\/features\/(?!intelligence\/)[^"']+\/server/,
      `${relative(root, path)} must receive cross-feature commands through composition`,
    );
  }

  assert.match(
    readSource("src/features/intelligence/components/account-intelligence.tsx"),
    /addManualIntelligence[^\n]+from "@\/features\/intelligence\/server\/actions"/,
  );
  assert.match(
    readSource("src/features/intelligence/components/research-status-controls.tsx"),
    /researchAccount[^\n]+from "@\/features\/intelligence\/server\/actions"/,
  );
  assert.match(
    readSource("src/features/intelligence/components/claim-review-controls.tsx"),
    /reviewIntelligenceClaim[^\n]+from "@\/features\/intelligence\/server\/actions"/,
  );
});

test("feature-private server modules do not depend on another feature's server layer", () => {
  for (const feature of readdirSync(featuresRoot, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const serverRoot = join(featuresRoot, feature.name, "server");
    if (!existsSync(serverRoot)) continue;
    for (const path of sourceFiles(serverRoot)) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(
        /from ["']@\/features\/([^/]+)\/server[^"']*["']/g,
      )) {
        assert.equal(
          match[1],
          feature.name,
          `${relative(root, path)} must not import ${match[1]}'s private server layer`,
        );
      }
    }
  }
});

test("shared Intelligence read-model and action-boundary types stay in lib/types", () => {
  const types = readSource("src/features/intelligence/lib/types.ts");
  for (const name of [
    "IntelligenceSource",
    "IntelligenceClaim",
    "ResearchJob",
    "CommercialFact",
    "FacilityOption",
    "IntelligenceReturnTab",
    "ContactPromotionAction",
  ]) {
    assert.match(types, new RegExp(`export type ${name}\\b`));
  }
  assert.doesNotMatch(
    readSource("src/features/intelligence/server/actions.ts"),
    /export type |export interface /,
  );
});
