import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function exportedAction(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must remain an exported server action`);
  const next = source.indexOf("\nexport async function ", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("existing contact edits cannot call the contacts update API", () => {
  const actions = readSource("src/features/accounts/server/actions/contacts.ts");
  const saveContact = exportedAction(actions, "saveContact");

  assert.match(saveContact, /\.from\("contacts"\)\s*\.insert\(/);
  assert.match(saveContact, /existingContact\.record_mode\s*!==\s*"sandbox"/);
  assert.match(saveContact, /rpc\("update_sandbox_contact"/);
  assert.doesNotMatch(saveContact, /\.from\("contacts"\)\.update\(/);
});

test("real contacts expose review, while direct edit stays limited to sandbox records", () => {
  const workspace = readSource(
    "src/features/accounts/components/people-panel.tsx",
  );

  assert.match(
    workspace,
    /contact\.record_mode === "sandbox"[\s\S]{0,180}<DisclosureForm label="Edit contact">/,
  );
  assert.match(
    workspace,
    /contact\.record_mode === "real"[\s\S]{0,180}<DisclosureForm label="Review details">/,
  );
  assert.doesNotMatch(workspace, /Edit sandbox contact/);
  assert.match(
    workspace,
    /Current\s+contact details remain untouched until a separate approval\./,
  );
});
