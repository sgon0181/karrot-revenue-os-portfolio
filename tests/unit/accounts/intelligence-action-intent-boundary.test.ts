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
    if (specifier === "next/cache") return nextResolve("next/cache.js", context);
    if (specifier === "next/navigation") {
      return nextResolve("next/navigation.js", context);
    }
    return nextResolve(specifier, context);
  },
});

let authenticationCount = 0;
let databaseCount = 0;
let paidCallCount = 0;
let revalidationCount = 0;
let redirectCount = 0;

const supabaseMock = mock.module(
  new URL("infrastructure/supabase/server.ts", srcRoot),
  {
    namedExports: {
      createClient: async () => ({
        from() {
          databaseCount += 1;
          throw new Error("Database access must not occur.");
        },
        rpc() {
          databaseCount += 1;
          throw new Error("RPC access must not occur.");
        },
      }),
    },
  },
);

const authMock = mock.module(
  new URL("infrastructure/supabase/auth.ts", srcRoot),
  {
    namedExports: {
      getAuthenticatedPrincipal: async () => {
        authenticationCount += 1;
        return { id: "editor-user", email: "editor@example.com", role: "editor" };
      },
    },
  },
);

const researchMock = mock.module(
  new URL("features/intelligence/server/openai-research.ts", srcRoot),
  {
    namedExports: {
      startAccountResearch: async () => {
        paidCallCount += 1;
        throw new Error("Paid research must not run.");
      },
      cancelAccountResearch: async () => false,
    },
  },
);

const cacheMock = mock.module("next/cache.js", {
  namedExports: {
    revalidatePath() {
      revalidationCount += 1;
    },
  },
});

const navigationMock = mock.module("next/navigation.js", {
  namedExports: {
    redirect() {
      redirectCount += 1;
      throw new Error("Redirect must not occur.");
    },
  },
});

after(() => {
  navigationMock.restore();
  cacheMock.restore();
  researchMock.restore();
  authMock.restore();
  supabaseMock.restore();
  hooks.deregister();
});

const { researchAccount } = await import(
  new URL("features/intelligence/server/actions.ts", srcRoot).href
);

test("the actual paid action authenticates then rejects non-manual intent before side effects", async () => {
  for (const intent of [null, "stage_change"]) {
    const formData = new FormData();
    formData.set("provider_id", "provider-a");
    if (intent !== null) formData.set("research_intent", intent);

    await assert.rejects(
      researchAccount(formData),
      /explicit manual request/i,
    );
  }

  assert.equal(authenticationCount, 2);
  assert.equal(databaseCount, 0);
  assert.equal(paidCallCount, 0);
  assert.equal(revalidationCount, 0);
  assert.equal(redirectCount, 0);
});
