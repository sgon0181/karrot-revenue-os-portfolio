import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test, { after, mock } from "node:test";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../../..");
const srcRoot = pathToFileURL(`${root}/src/`);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`${specifier.slice(2)}.ts`, srcRoot).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

const authMock = mock.module(
  new URL("infrastructure/supabase/auth.ts", srcRoot),
  {
    namedExports: {
      getAuthenticatedPrincipal: async () => ({
        id: "editor-1",
        email: "editor@example.test",
        role: "editor",
      }),
    },
  },
);

let activeSupabase: unknown;
const serverMock = mock.module(
  new URL("infrastructure/supabase/server.ts", srcRoot),
  {
    namedExports: {
      createClient: async () => activeSupabase,
    },
  },
);

after(() => {
  serverMock.restore();
  authMock.restore();
  hooks.deregister();
});

const { loadProviderWorkspaceTabData } = await import(
  new URL("features/accounts/server/load-provider-tabs.ts", srcRoot).href
);
const { loadProviderWorkspaceCore } = await import(
  new URL(
    "features/accounts/server/load-provider-workspace-core.ts",
    srcRoot,
  ).href
);
const { loadProviderWorkspace } = await import(
  new URL(
    "features/accounts/server/load-provider-workspace.ts",
    srcRoot,
  ).href
);

type QueryMethod = { name: string; args: unknown[] };
type QueryCall = { table: string; methods: QueryMethod[] };

function recordingSupabase(
  tableData: Record<string, unknown> = {},
) {
  const calls: QueryCall[] = [];
  const supabase = {
    from(table: string) {
      const call = { table, methods: [] as QueryMethod[] };
      calls.push(call);
      const builder = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") {
              return (resolvePromise: (value: unknown) => void) =>
                resolvePromise({
                  data: Object.hasOwn(tableData, table) ? tableData[table] : [],
                  error: null,
                  count: table === "contacts" ? 0 : null,
                });
            }
            return (...args: unknown[]) => {
              call.methods.push({ name: String(property), args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { supabase, calls };
}

test("the shared account core is a fixed seven-query lightweight header scope", async () => {
  const { supabase, calls } = recordingSupabase({
    providers: {
      id: "provider-1",
      business_name: "Provider One",
      entity_name: "Provider One Pty Ltd",
      abn: "123",
      registration_status: "Registered",
    },
  });
  const loaded = await loadProviderWorkspaceCore(
    supabase as never,
    "provider-1",
    undefined,
  );
  assert.ok(loaded);
  assert.equal(loaded.canEdit, true);
  assert.deepEqual(
    calls.map((call) => call.table),
    [
      "providers",
      "v_facility_latest",
      "contacts",
      "opportunities",
      "activities",
      "next_actions",
      "customer_relationships",
    ],
  );
  assert.equal(calls.length, 7);
  assert.ok(
    calls
      .find((call) => call.table === "contacts")
      ?.methods.some((method) => method.name === "select"),
  );
});

test("a missing provider returns null before any tab loader runs", async () => {
  const { supabase, calls } = recordingSupabase({ providers: null });
  activeSupabase = supabase;
  const workspace = await loadProviderWorkspace(
    "missing-provider",
    "overview",
  );
  assert.equal(workspace, null);
  assert.deepEqual(
    calls.map((call) => call.table),
    ["providers", "v_facility_latest"],
  );
});

const providerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownedFacilityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherFacilityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function facilityFilterValues(calls: QueryCall[]) {
  return calls
    .filter((call) => call.table === "account_research_jobs")
    .flatMap((call) => call.methods)
    .filter(
      (method) =>
        method.name === "eq" && method.args[0] === "facility_id",
    )
    .map((method) => method.args[1]);
}

async function loadWorkspaceForFacility(
  tab: "overview" | "people",
  facility: string | string[],
) {
  const { supabase, calls } = recordingSupabase({
    providers: {
      id: providerId,
      business_name: "Provider One",
      entity_name: "Provider One Pty Ltd",
      abn: "123",
      registration_status: "Registered",
    },
    v_facility_latest: [
      { id: ownedFacilityId, name: "Owned Facility" },
    ],
  });
  activeSupabase = supabase;
  const workspace = await loadProviderWorkspace(providerId, tab, facility);
  assert.ok(workspace);
  return { workspace, calls };
}

test("malformed facility queries fail closed before Overview UUID filters", async () => {
  for (const facility of ["", "not-a-uuid"]) {
    const { workspace, calls } = await loadWorkspaceForFacility(
      "overview",
      facility,
    );
    assert.equal(workspace.selectedFacilityId, null);
    assert.equal(workspace.requestedFacilityMissing, true);
    assert.deepEqual(facilityFilterValues(calls), []);
  }
});

test("duplicate facility queries fail closed before People UUID filters", async () => {
  const { workspace, calls } = await loadWorkspaceForFacility("people", [
    ownedFacilityId,
    ownedFacilityId,
  ]);
  assert.equal(workspace.selectedFacilityId, null);
  assert.equal(workspace.requestedFacilityMissing, true);
  assert.deepEqual(facilityFilterValues(calls), []);
});

test("valid but unowned facility queries stay safe and use the missing fallback", async () => {
  const { workspace, calls } = await loadWorkspaceForFacility(
    "overview",
    otherFacilityId,
  );
  assert.equal(workspace.selectedFacilityId, null);
  assert.equal(workspace.requestedFacilityMissing, true);
  assert.deepEqual(facilityFilterValues(calls), [
    otherFacilityId,
    otherFacilityId,
    otherFacilityId,
  ]);
});

test("a single valid selected facility scopes the active People loader", async () => {
  const { workspace, calls } = await loadWorkspaceForFacility(
    "people",
    ownedFacilityId.toUpperCase(),
  );
  assert.equal(workspace.selectedFacilityId, ownedFacilityId);
  assert.equal(workspace.requestedFacilityMissing, false);
  assert.deepEqual(facilityFilterValues(calls), [
    ownedFacilityId,
    ownedFacilityId,
    ownedFacilityId,
  ]);
});

test("the primary active stage is ordered by newest opportunity update", async () => {
  const { supabase, calls } = recordingSupabase({
    providers: {
      id: providerId,
      business_name: "Provider One",
      entity_name: "Provider One Pty Ltd",
      abn: "123",
      registration_status: "Registered",
    },
    opportunities: [
      {
        record_mode: "real",
        pipeline_stages: { name: "Negotiation", outcome: null },
      },
      {
        record_mode: "real",
        pipeline_stages: { name: "Discovery", outcome: null },
      },
    ],
  });
  const workspace = await loadProviderWorkspaceCore(
    supabase as never,
    providerId,
  );
  assert.ok(workspace);
  assert.equal(workspace.header.primaryActiveStage, "Negotiation");
  assert.ok(
    calls
      .find((call) => call.table === "opportunities")
      ?.methods.some(
        (method) =>
          method.name === "order" &&
          method.args[0] === "updated_at" &&
          (method.args[1] as { ascending?: boolean }).ascending === false,
      ),
  );
});

async function tablesFor(
  tab: "overview" | "people" | "intelligence" | "commercial" | "evidence",
) {
  const { supabase, calls } = recordingSupabase();
  const selected = await loadProviderWorkspaceTabData(
    supabase as never,
    "provider-1",
    tab,
    ownedFacilityId,
  );
  return {
    selectedTab: selected.tab,
    tables: calls.map((call) => call.table),
  };
}

test("each provider tab fetches only its owned query scope", async () => {
  const overview = await tablesFor("overview");
  assert.equal(overview.selectedTab, "overview");
  assert.deepEqual(overview.tables, [
    "providers",
    "contacts",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
  ]);
  const people = await tablesFor("people");
  assert.equal(people.selectedTab, "people");
  assert.deepEqual(people.tables, [
    "providers",
    "contacts",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
    "account_research_jobs",
  ]);
  const intelligence = await tablesFor("intelligence");
  assert.equal(intelligence.selectedTab, "intelligence");
  assert.deepEqual(intelligence.tables, [
    "account_research_jobs",
    "intelligence_claims",
    "intelligence_sources",
    "commercial_account_facts",
  ]);
  const commercial = await tablesFor("commercial");
  assert.equal(commercial.selectedTab, "commercial");
  assert.deepEqual(commercial.tables, [
    "providers",
    "contacts",
    "opportunities",
    "pipeline_stages",
    "activities",
    "next_actions",
    "customer_relationships",
  ]);
  const evidence = await tablesFor("evidence");
  assert.equal(evidence.selectedTab, "evidence");
  assert.deepEqual(evidence.tables, [
    "providers",
    "provider_snapshots",
    "account_research_jobs",
    "intelligence_claims",
    "intelligence_sources",
    "commercial_account_facts",
    "commercial_account_facts",
    "intelligence_review_events",
    "contacts",
  ]);
});

test("inactive tab datasets cannot leak into unrelated loaders", () => {
  const source = readFileSync(
    join(root, "src/features/accounts/server/load-provider-tabs.ts"),
    "utf8",
  );
  const sections = Object.fromEntries(
    [
      "loadOverviewTab",
      "loadPeopleTab",
      "loadIntelligenceTab",
      "loadCommercialTab",
      "loadEvidenceTab",
    ].map((name, index, names) => {
      const start = source.indexOf(`export async function ${name}`);
      const end =
        index + 1 < names.length
          ? source.indexOf(`export async function ${names[index + 1]}`, start)
          : source.indexOf("export type OverviewTabData", start);
      return [name, source.slice(start, end)];
    }),
  );

  assert.doesNotMatch(sections.loadOverviewTab, /provider_snapshots|opportunities|customer_relationships/);
  assert.doesNotMatch(sections.loadPeopleTab, /provider_snapshots|opportunities|customer_relationships/);
  assert.doesNotMatch(sections.loadIntelligenceTab, /contacts|opportunities|provider_snapshots/);
  assert.doesNotMatch(sections.loadCommercialTab, /intelligence_claims|provider_snapshots|intelligence_review_events/);
  assert.doesNotMatch(sections.loadEvidenceTab, /pipeline_stages|next_actions|activities/);
});
