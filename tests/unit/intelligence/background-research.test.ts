import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function exportedAction(value: string, name: string) {
  const marker = `export async function ${name}`;
  const start = value.indexOf(marker);
  assert.notEqual(start, -1);
  const next = value.indexOf("\nexport async function ", start + marker.length);
  return value.slice(start, next === -1 ? value.length : next);
}

test("manual research dispatches a background response before returning", () => {
  const adapter = source("src/features/intelligence/server/openai-research.ts");
  const action = exportedAction(
    source("src/features/intelligence/server/actions.ts"),
    "researchAccount",
  );

  assert.match(adapter, /background:\s*true/);
  assert.match(adapter, /store:\s*false/);
  assert.match(adapter, /export async function startAccountResearch/);
  assert.match(adapter, /export async function retrieveAccountResearch/);
  assert.match(adapter, /searchParams\.append\("include\[\]", "web_search_call\.action\.sources"\)/);
  assert.doesNotMatch(adapter, /searchParams\.append\("include",/);
  assert.match(adapter, /method:\s*"GET"[\s\S]{0,160}cache:\s*"no-store"/);

  const jobStart = action.indexOf('rpc("start_scoped_account_research"');
  const responseStart = action.indexOf("await startAccountResearch(");
  const responseAttach = action.indexOf('rpc("attach_account_research_response"');
  const redirect = action.lastIndexOf("redirect(");
  assert.ok(jobStart >= 0 && jobStart < responseStart);
  assert.ok(responseStart < responseAttach && responseAttach < redirect);
  assert.doesNotMatch(action, /rpc\("complete_account_research"/);
});

test("reconciliation is authenticated, creator-scoped and never starts research", () => {
  const route = source("src/app/api/intelligence/research/reconcile/route.ts");

  assert.match(route, /supabase\.auth\.getClaims\(\)/);
  assert.match(route, /\.eq\("created_by", userId\)/);
  assert.match(route, /if \(!job\.response_id\)/);
  assert.match(route, /DISPATCH_TIMEOUT_MS = 60_000/);
  assert.match(route, /p_error_code: "research_dispatch_abandoned"/);
  assert.doesNotMatch(route, /\.not\("response_id",\s*"is",\s*null\)/);
  assert.match(route, /retrieveAccountResearch\(job\.response_id, job\.model\)/);
  assert.match(route, /rpc\("complete_account_research"/);
  assert.match(route, /rpc\("fail_account_research"/);
  assert.match(route, /isRetryableResearchError\(error\)/);
  assert.doesNotMatch(route, /startAccountResearch\s*\(/);
});

test("the app follows active work across navigation without refreshing unrelated screens", () => {
  const layout = source("src/app/(app)/layout.tsx");
  const shell = source("src/shared/components/app-shell.tsx");
  const poller = source(
    "src/features/intelligence/components/research-progress-reconciler.tsx",
  );
  const submit = source(
    "src/features/intelligence/components/research-submit-button.tsx",
  );

  assert.match(layout, /\.eq\("created_by", principal\.id\)/);
  assert.match(shell, /<ResearchProgressReconciler active=\{researchActive\}/);
  assert.match(submit, /dispatchEvent\(new Event\(RESEARCH_STARTED_EVENT\)\)/);
  assert.match(poller, /window\.addEventListener\(RESEARCH_STARTED_EVENT, wake\)/);
  assert.match(poller, /pathnameRef\.current === `\/providers\/\$\{providerId\}`/);
  assert.match(poller, /if \(currentProviderTransitioned\) router\.refresh\(\)/);
  assert.match(poller, /return null/);
});

test("LinkedIn discovery remains cited, optional and exact-URL persisted", () => {
  const adapter = source("src/features/intelligence/server/openai-research.ts");

  assert.match(adapter, /web search actually surfaces it/);
  assert.match(adapter, /Never construct, guess or scrape a LinkedIn URL/);
  assert.match(adapter, /Ambiguity or absence is normal/);
  assert.match(adapter, /canonicalSourceUrls/);
  assert.match(adapter, /canonicalSourceUrls\.get\(normalized\)/);
});
