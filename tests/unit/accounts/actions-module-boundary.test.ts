import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const actionMap = {
  contacts: ["saveContact", "proposeContactChange", "reviewContactChange"],
  opportunities: ["createOpportunity", "updateOpportunityStage", "updateOpportunity"],
  activities: ["logActivity"],
  "next-actions": ["createNextAction", "completeNextAction", "rescheduleNextAction"],
  customers: ["updateCustomer", "addCustomerFacility"],
};

test("account actions retain a thin stable facade over domain Server Action modules", () => {
  const facade = readSource("src/features/accounts/server/actions.ts");
  assert.doesNotMatch(facade, /["']use server["']/);
  assert.doesNotMatch(facade, /export async function/);

  for (const [moduleName, actions] of Object.entries(actionMap)) {
    assert.match(
      facade,
      new RegExp(`from "@/features/accounts/server/actions/${moduleName}";`),
      `${moduleName} must remain reachable through the stable facade`,
    );

    const implementation = readSource(
      `src/features/accounts/server/actions/${moduleName}.ts`,
    );
    assert.match(implementation, /^"use server";/);
    for (const action of actions) {
      assert.match(
        implementation,
        new RegExp(`export async function ${action}\\(`),
        `${action} must remain a domain Server Action`,
      );
      assert.match(
        facade,
        new RegExp(`\\b${action},?`),
        `${action} must remain a facade export`,
      );
    }
  }
});

test("account action authentication remains centralised in the cached principal context", () => {
  const context = readSource(
    "src/features/accounts/server/actions/context.ts",
  );
  assert.match(context, /getAuthenticatedPrincipal\(\)/);
  assert.doesNotMatch(context, /\.auth\.(?:getUser|getSession)\s*\(/);
  assert.doesNotMatch(context, /\.from\(["']profiles["']\)/);

  for (const moduleName of Object.keys(actionMap)) {
    const implementation = readSource(
      `src/features/accounts/server/actions/${moduleName}.ts`,
    );
    assert.match(implementation, /await accountActionContext\(\)/);
    assert.doesNotMatch(implementation, /getAuthenticatedPrincipal\(\)/);
    assert.doesNotMatch(implementation, /\.auth\.(?:getUser|getSession)\s*\(/);
    assert.doesNotMatch(implementation, /\.from\(["']profiles["']\)/);
  }
});
