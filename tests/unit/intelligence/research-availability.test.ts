import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("account and facility intelligence hide research controls when research is unavailable", () => {
  const intelligence = source(
    "src/features/intelligence/components/account-intelligence.tsx",
  );
  const controls = source(
    "src/features/intelligence/components/research-status-controls.tsx",
  );
  assert.match(intelligence, /researchAllowed: boolean/);
  assert.equal(
    (intelligence.match(/canEdit && researchAllowed/g) ?? []).length,
    2,
    "provider and facility actions must both require research availability",
  );
  assert.equal(
    (intelligence.match(/researchAllowed && !researchConfigured/g) ?? []).length,
    2,
    "configuration warnings should not appear for research-ineligible records",
  );
  assert.match(
    controls,
    /Live public-source research typically takes 30 to 70 seconds\./,
    "the shared provider and facility action sets the live-research wait expectation",
  );
});

test("unavailable research uses a neutral status and truthful empty copy", () => {
  const status = source(
    "src/features/intelligence/components/research-status-controls.tsx",
  );
  const briefs = source(
    "src/features/intelligence/components/brief-sections.tsx",
  );
  assert.match(status, /if \(!researchAllowed\)/);
  assert.match(status, /Research unavailable/);
  assert.match(briefs, /Web intelligence is not available for this account/);
  const panel = source("src/features/accounts/components/intelligence-panel.tsx");
  assert.match(panel, /if \(core\.provider\.is_sample\)/);
  assert.match(panel, /No authoritative provider source is attached to this account/);
  assert.equal(
    (panel.match(/Meeting preparation, post-visit capture and drafted communications are the next milestones and are deliberately not automated yet\. Research assists; humans decide\./g) ?? []).length,
    2,
    "the deliberate future boundary appears in both authoritative and sample Intelligence paths",
  );
});

test("the sample overview omits research-only recommendation and unknown cards", () => {
  const overview = source(
    "src/features/accounts/components/overview-panel.tsx",
  );
  assert.match(overview, /const researchAllowed = !provider\.is_sample/);
  assert.match(overview, /\{researchAllowed \? <section className="card">/);
  assert.match(overview, /Choose a facility to see its address and planning context/);
});

test("sample people and evidence stay ordinary without research or government claims", () => {
  const people = source("src/features/accounts/components/people-panel.tsx");
  const evidence = source("src/features/accounts/components/evidence-panel.tsx");
  const facility = source(
    "src/features/accounts/components/provider-workspace-shared.tsx",
  );
  assert.match(people, /!core\.provider\.is_sample \? <section className="card">/);
  assert.match(evidence, /This account was entered directly and has no external source records/);
  assert.match(evidence, /!core\.provider\.is_sample \? <>/);
  assert.match(facility, /isSample \? "Facility details" : "Government data"/);
  assert.match(facility, /evidence && !isSample/);
  assert.match(facility, /facility\.location_label/);
});
