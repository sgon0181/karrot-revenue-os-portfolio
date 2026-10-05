import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import test from "node:test";
import {
  assertManualResearchIntent,
  MANUAL_RESEARCH_INTENT,
  // Node's built-in type stripping requires the extension; the production
  // TypeScript configuration intentionally does not enable TS extension imports.
  // @ts-expect-error exercised directly with `node --test`
} from "../../../src/features/intelligence/server/manual-research.ts";

const root = resolve(import.meta.dirname, "../../..");
const sourceRoot = join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

function exportedAction(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must remain an exported server action`);
  const next = source.indexOf(
    "\nexport async function ",
    start + marker.length,
  );
  return source.slice(start, next === -1 ? source.length : next);
}

test("paid research rejects missing or synthetic trigger intent", () => {
  const explicitRequest = new FormData();
  explicitRequest.set("research_intent", MANUAL_RESEARCH_INTENT);
  assert.doesNotThrow(() => assertManualResearchIntent(explicitRequest));

  assert.throws(
    () => assertManualResearchIntent(new FormData()),
    /explicit manual request/i,
  );

  const autonomousRequest = new FormData();
  autonomousRequest.set("research_intent", "stage_change");
  assert.throws(
    () => assertManualResearchIntent(autonomousRequest),
    /explicit manual request/i,
  );
});

test("paid research can start only from the authenticated manual action", () => {
  const files = sourceFiles(sourceRoot);
  const adapterImporters = files
    .filter((path) =>
      readSource(path).includes(
        "@/features/intelligence/server/openai-research",
      ),
    )
    .map((path) => relative(root, path));
  assert.deepEqual(adapterImporters, [
    "src/app/api/intelligence/research/reconcile/route.ts",
    "src/features/intelligence/server/actions.ts",
  ]);

  const actions = readSource(
    join(root, "src/features/intelligence/server/actions.ts"),
  );
  const research = exportedAction(actions, "researchAccount");
  assert.equal(
    (actions.match(/await startAccountResearch\s*\(/g) ?? []).length,
    1,
  );
  assert.match(research, /await startAccountResearch\s*\(/);

  const authentication = research.indexOf("await intelligenceActionContext()");
  const manualGuard = research.indexOf("assertManualResearchIntent(formData)");
  const jobStart = research.search(/rpc\(\s*"start_scoped_account_research"/);
  const paidCall = research.indexOf("await startAccountResearch(");
  assert.ok(
    authentication >= 0 && authentication < manualGuard,
    "authentication must run before the manual-intent guard",
  );
  assert.ok(
    manualGuard < jobStart,
    "manual intent must be verified before a research job starts",
  );
  assert.ok(
    jobStart < paidCall,
    "the persisted job must be created before paid execution",
  );

  const reconciliation = readSource(
    join(root, "src/app/api/intelligence/research/reconcile/route.ts"),
  );
  assert.match(reconciliation, /retrieveAccountResearch\(/);
  assert.match(reconciliation, /\.eq\("created_by", userId\)/);
  assert.doesNotMatch(
    reconciliation,
    /startAccountResearch\s*\(/,
    "navigation polling may retrieve a manually-started response but must never start paid research",
  );
});

test("rendering, navigation and commercial stage changes cannot start paid research", () => {
  const files = sourceFiles(sourceRoot);
  const renderOrNavigationCalls = files
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .filter((path) => !path.endsWith("server/actions.ts"))
    .filter((path) => !path.endsWith("features/intelligence/server/actions.ts"))
    .filter((path) => !path.endsWith("server/openai-research.ts"))
    .filter((path) => /\bresearchAccount\s*\(/.test(readSource(path)))
    .map((path) => relative(root, path));
  assert.deepEqual(renderOrNavigationCalls, []);

  const commercialActions = {
    saveContact: "contacts",
    createOpportunity: "opportunities",
    updateOpportunityStage: "opportunities",
    updateOpportunity: "opportunities",
    logActivity: "activities",
    createNextAction: "next-actions",
    completeNextAction: "next-actions",
    rescheduleNextAction: "next-actions",
    updateCustomer: "customers",
    addCustomerFacility: "customers",
  };
  for (const [actionName, moduleName] of Object.entries(commercialActions)) {
    const actions = readSource(
      join(root, `src/features/accounts/server/actions/${moduleName}.ts`),
    );
    assert.doesNotMatch(
      exportedAction(actions, actionName),
      /runAccountResearch|start_scoped_account_research|account_research_jobs|openai/i,
      `${actionName} must not start paid research`,
    );
  }

  const researchBindings = files
    .filter((path) => path.endsWith(".tsx"))
    .map((path) => ({ path, source: readSource(path) }))
    .filter(({ source }) => source.includes("action={researchAccount}"));
  assert.ok(
    researchBindings.length > 0,
    "the explicit manual research form must remain available",
  );
  for (const { path, source } of researchBindings) {
    assert.match(source, /<form[^>]+action=\{researchAccount\}/);
    assert.match(
      source,
      /<input[^>]+name="research_intent"[^>]+value="manual"/,
      `${relative(root, path)} must label the request as an explicit manual action`,
    );
    assert.doesNotMatch(
      source,
      /(?:useEffect|startTransition|setInterval|setTimeout)[\s\S]{0,240}researchAccount/,
    );
  }
});
