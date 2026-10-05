import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function exportedFunction(source: string, name: string) {
  const marker = `export function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const next = source.indexOf("\nexport function ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

function exportedAction(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must remain an exported server action`);
  const next = source.indexOf("\nexport async function ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

const actionModules: Record<string, string> = {
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

function accountAction(name: string) {
  const moduleName = actionModules[name];
  assert.ok(moduleName, `missing action module map for ${name}`);
  return exportedAction(
    readSource(`src/features/accounts/server/actions/${moduleName}.ts`),
    name,
  );
}

test("commercial and contact forms submit an optional return target", () => {
  const commercialForms = readSource(
    "src/features/commercial/components/commercial-forms.tsx",
  );
  const contactForm = readSource(
    "src/features/accounts/components/contact-form.tsx",
  );

  for (const name of ["OpportunityForm", "ActivityForm", "NextActionForm"]) {
    const component = exportedFunction(commercialForms, name);
    assert.match(component, /returnTo\?: string;/, `${name} must accept returnTo`);
    assert.match(
      component,
      /returnTo \? <InternalReturnToInput returnTo=\{returnTo\} \/> : null/,
      `${name} must submit return_to`,
    );
  }

  assert.match(contactForm, /returnTo\?: string;/);
  assert.match(
    contactForm,
    /returnTo \? <InternalReturnToInput returnTo=\{returnTo\} \/> : null/,
  );
});

test("return inputs inherit the browser-only fragment through the shared validator", () => {
  const input = readSource(
    "src/shared/components/internal-return-to-input.tsx",
  );
  assert.match(input, /withInheritedHash\(\s*returnTo,\s*window\.location\.hash,\s*\)/);
  assert.match(input, /name = "return_to"/);
  assert.match(input, /defaultValue=\{returnTo\}/);
});

test("mutation boundaries reject duplicate raw form values and use action-specific scopes", () => {
  const navigation = readSource(
    "src/features/accounts/server/actions/navigation.ts",
  );

  assert.match(
    navigation,
    /function validatedFormReturnTo\(formData: FormData\) \{\s*return validatedSingleInternalPath\(formData\.getAll\("return_to"\)\);\s*\}/,
  );

  const scopedPolicies = {
    saveContact: "saveContactReturnPath",
    createOpportunity: "createOpportunityReturnPath",
    logActivity: "logActivityReturnPath",
    createNextAction: "createNextActionReturnPath",
    updateCustomer: "updateCustomerReturnPath",
    addCustomerFacility: "addCustomerFacilityReturnPath",
  };
  for (const [name, policy] of Object.entries(scopedPolicies)) {
    const action = accountAction(name);
    assert.match(
      action,
      new RegExp(`${policy}\\(\\s*formData,\\s*providerId`),
      `${name} must apply its resource-scoped return policy`,
    );
    assert.match(
      action,
      /commercialMessagePath\(/,
      `${name} must append its success notice without replacing URL context`,
    );
  }

  for (const name of ["logActivity", "createNextAction"]) {
    assert.match(
      accountAction(name),
      /verifiedMutationReturnOpportunityId\(/,
      `${name} must verify an Opportunity origin belongs to the submitted Provider`,
    );
  }

  const verifierStart = navigation.indexOf("async function verifiedMutationReturnOpportunityId");
  const verifierEnd = navigation.indexOf("\nexport function commercialMessagePath", verifierStart);
  const verifier = navigation.slice(verifierStart, verifierEnd);
  assert.match(verifier, /mutationReturnOpportunityId\(formData\)/);
  assert.match(verifier, /\.eq\("id", requestedOpportunityId\)/);
  assert.match(verifier, /\.eq\("provider_id", providerId\)/);
});

test("message redirects retain existing query and fragment context", () => {
  const navigation = readSource(
    "src/features/accounts/server/actions/navigation.ts",
  );
  const helperStart = navigation.indexOf("function commercialMessagePath");
  const helperEnd = navigation.indexOf("\nexport function commercialAlertPath", helperStart);
  const helper = navigation.slice(helperStart, helperEnd);

  assert.match(helper, /new URL\(safeInternalPath\(destination\),/);
  assert.match(helper, /url\.searchParams\.set\(kind, message\)/);
  assert.match(helper, /`\$\{url\.pathname\}\$\{url\.search\}\$\{url\.hash\}`/);

  const saveContact = accountAction("saveContact");
  assert.match(saveContact, /commercialAlertPath\(errorDestination, readableInputError\(error\)\)/);
  assert.match(saveContact, /commercialAlertPath\(errorDestination, "The contact could not be found\."\)/);
  assert.match(saveContact, /commercialMessagePath\(returnTo, "notice", successMessage\)/);

  const createOpportunity = accountAction("createOpportunity");
  assert.match(
    createOpportunity,
    /commercialMessagePath\(\s*withReturnTo\(`\/opportunities\/\$\{opportunity\.id\}`, returnTo\),\s*"notice",\s*"Opportunity created\.",\s*\)/,
  );
});

test("task and opportunity mutation restrictions remain route scoped", () => {
  for (const name of [
    "updateOpportunityStage",
    "updateOpportunity",
    "completeNextAction",
    "rescheduleNextAction",
  ]) {
    const action = accountAction(name);
    assert.match(action, /samePathInternalPath\(/);
    assert.match(action, /`\/opportunities\/\$\{opportunityId\}`/);
  }

  assert.match(
    accountAction("updateOpportunityStage"),
    /samePathInternalPath\(requestedDestination, "\/pipeline"\)/,
  );

  for (const name of ["completeNextAction", "rescheduleNextAction"]) {
    const action = accountAction(name);
    assert.match(action, /samePathInternalPath\(returnTo, `\/providers\/\$\{providerId\}`\)/);
    assert.match(action, /validatedTasksPath\(returnTo\)/);
  }
});
