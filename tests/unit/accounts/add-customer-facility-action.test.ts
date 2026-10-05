import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after, mock } from "node:test";
import { pathToFileURL } from "node:url";

const srcRoot = pathToFileURL(`${process.cwd()}/src/`);

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`${specifier.slice(2)}.ts`, srcRoot).href,
        context,
      );
    }
    if (specifier === "next/cache") {
      return nextResolve("next/cache.js", context);
    }
    if (specifier === "next/navigation") {
      return nextResolve("next/navigation.js", context);
    }
    return nextResolve(specifier, context);
  },
});

type Lookup = {
  table: string;
  filters: Array<[string, string]>;
};

const lookups: Lookup[] = [];
const tables: string[] = [];
const revalidated: string[] = [];
let insertCount = 0;
let ownershipMatches = false;
let insertedPayload: Record<string, unknown> | null = null;

function lookupBuilder(table: string) {
  const filters: Array<[string, string]> = [];
  const builder = {
    select(column: string) {
      assert.equal(column, "id");
      return builder;
    },
    eq(column: string, value: string) {
      filters.push([column, value]);
      return builder;
    },
    async maybeSingle() {
      lookups.push({ table, filters: [...filters] });
      return {
        data: ownershipMatches ? { id: table === "facilities" ? "facility-b" : "customer-b" } : null,
        error: null,
      };
    },
  };
  return builder;
}

const supabase = {
  from(table: string) {
    tables.push(table);

    if (table === "customer_relationships" || table === "facilities") {
      return lookupBuilder(table);
    }
    if (table === "customer_facilities") {
      return {
        insert(payload: Record<string, unknown>) {
          insertCount += 1;
          insertedPayload = payload;
          return {
            select() {
              return {
                async single() {
                  return { data: { id: "unexpected" }, error: null };
                },
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  },
};

class RedirectSignal extends Error {
  destination: string;

  constructor(destination: string) {
    super("NEXT_REDIRECT");
    this.destination = destination;
  }
}

const supabaseMock = mock.module(
  new URL("infrastructure/supabase/server.ts", srcRoot),
  {
    namedExports: {
      createClient: async () => supabase,
    },
  },
);

const authMock = mock.module(
  new URL("infrastructure/supabase/auth.ts", srcRoot),
  {
    namedExports: {
      getAuthenticatedPrincipal: async () => ({
        id: "editor-user",
        email: "editor@example.com",
        role: "editor",
      }),
    },
  },
);

const cacheMock = mock.module("next/cache.js", {
  namedExports: {
    revalidatePath(path: string) {
      revalidated.push(path);
    },
  },
});

const navigationMock = mock.module("next/navigation.js", {
  namedExports: {
    redirect(destination: string) {
      throw new RedirectSignal(destination);
    },
  },
});

after(() => {
  navigationMock.restore();
  cacheMock.restore();
  authMock.restore();
  supabaseMock.restore();
  hooks.deregister();
});

const accountActions = await import(
  new URL("features/accounts/server/actions.ts", srcRoot).href
);
const { addCustomerFacility } = accountActions;

test("the stable facade resolves every account Server Action export", () => {
  assert.deepEqual(Object.keys(accountActions).sort(), [
    "addCustomerFacility",
    "completeNextAction",
    "createNextAction",
    "createOpportunity",
    "logActivity",
    "proposeContactChange",
    "rescheduleNextAction",
    "reviewContactChange",
    "saveContact",
    "updateCustomer",
    "updateOpportunity",
    "updateOpportunityStage",
  ]);
  for (const action of Object.values(accountActions)) {
    assert.equal(typeof action, "function");
  }
});

test("addCustomerFacility enforces ownership before its executable insert boundary", async () => {
  const formData = new FormData();
  formData.set("provider_id", "provider-a");
  formData.set("customer_id", "customer-b");
  formData.set("facility_id", "facility-b");
  formData.set("status", "live");
  formData.set(
    "return_to",
    "/providers/provider-a?tab=commercial#customer",
  );

  let thrown: unknown;
  try {
    await addCustomerFacility(formData);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof RedirectSignal);
  const destination = new URL(thrown.destination, "https://karrot.local");
  assert.equal(destination.pathname, "/providers/provider-a");
  assert.equal(destination.searchParams.get("tab"), "commercial");
  assert.equal(
    destination.searchParams.get("commercial_alert"),
    "The selected customer or facility is no longer available for this provider.",
  );
  assert.equal(destination.hash, "#customer");

  assert.deepEqual(lookups, [
    {
      table: "customer_relationships",
      filters: [
        ["id", "customer-b"],
        ["provider_id", "provider-a"],
      ],
    },
    {
      table: "facilities",
      filters: [
        ["id", "facility-b"],
        ["provider_id", "provider-a"],
      ],
    },
  ]);
  assert.deepEqual(tables, ["customer_relationships", "facilities"]);
  assert.equal(insertCount, 0);
  assert.equal(insertedPayload, null);
  assert.deepEqual(revalidated, []);

  lookups.length = 0;
  tables.length = 0;
  revalidated.length = 0;
  ownershipMatches = true;
  thrown = undefined;
  try {
    await addCustomerFacility(formData);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof RedirectSignal);
  const successDestination = new URL(thrown.destination, "https://karrot.local");
  assert.equal(successDestination.pathname, "/providers/provider-a");
  assert.equal(successDestination.searchParams.get("tab"), "commercial");
  assert.equal(
    successDestination.searchParams.get("notice"),
    "Customer facility saved.",
  );
  assert.equal(successDestination.hash, "#customer");
  assert.deepEqual(tables, [
    "customer_relationships",
    "facilities",
    "customer_facilities",
  ]);
  assert.equal(insertCount, 1);
  assert.deepEqual(insertedPayload, {
    customer_relationship_id: "customer-b",
    facility_id: "facility-b",
    status: "live",
    onboarding_state: null,
    contracted_beds: null,
    live_beds: null,
    contract_start_date: null,
    go_live_date: null,
    notes: null,
  });
  assert.deepEqual(revalidated, [
    "/providers/provider-a",
    "/customers",
    "/dashboard",
  ]);
});
