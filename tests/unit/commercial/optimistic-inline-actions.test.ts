import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after, beforeEach, mock } from "node:test";
import { pathToFileURL } from "node:url";

const srcRoot = pathToFileURL(`${process.cwd()}/src/`);

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, srcRoot).href, context);
    }
    if (specifier === "next/cache") return nextResolve("next/cache.js", context);
    return nextResolve(specifier, context);
  },
});

type Result = { data: Record<string, unknown> | null; error: { message: string } | null };
type Operation = {
  table: string;
  kind: "select" | "update";
  columns?: string;
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const operations: Operation[] = [];
const revalidated: string[] = [];
let role = "editor";
let createClientCalls = 0;
let opportunityResult: Result;
let stageResult: Result;
let opportunityUpdateResult: Result;
let taskUpdateResult: Result;
let taskCurrentResult: Result;

function resultFor(operation: Operation): Result {
  if (operation.table === "pipeline_stages") return stageResult;
  if (operation.table === "opportunities" && operation.kind === "select") return opportunityResult;
  if (operation.table === "opportunities" && operation.kind === "update") return opportunityUpdateResult;
  if (operation.table === "next_actions" && operation.kind === "update") return taskUpdateResult;
  if (operation.table === "next_actions" && operation.kind === "select") return taskCurrentResult;
  throw new Error(`Unexpected operation: ${operation.kind} ${operation.table}`);
}

function tableBuilder(table: string) {
  let operation: Operation | null = null;
  const builder = {
    select(columns: string) {
      if (operation?.kind === "update") return builder;
      operation = { table, kind: "select", columns, filters: [] };
      return builder;
    },
    update(payload: Record<string, unknown>) {
      operation = { table, kind: "update", payload, filters: [] };
      return builder;
    },
    eq(column: string, value: unknown) {
      assert.ok(operation, "select or update must precede filters");
      operation.filters.push([column, value]);
      return builder;
    },
    async maybeSingle() {
      assert.ok(operation, "an operation must exist before maybeSingle");
      operations.push(operation);
      return resultFor(operation);
    },
  };
  return builder;
}

const supabase = {
  from(table: string) {
    return tableBuilder(table);
  },
};

const authMock = mock.module(
  new URL("infrastructure/supabase/auth.ts", srcRoot),
  {
    namedExports: {
      async getAuthenticatedPrincipal() {
        return { id: "user-1", email: "user@example.com", role };
      },
    },
  },
);

const serverMock = mock.module(
  new URL("infrastructure/supabase/server.ts", srcRoot),
  {
    namedExports: {
      async createClient() {
        createClientCalls += 1;
        return supabase;
      },
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

after(() => {
  cacheMock.restore();
  serverMock.restore();
  authMock.restore();
  hooks.deregister();
});

const {
  completeNextActionInline,
  moveOpportunityStageInline,
} = await import(new URL("features/commercial/server/inline-actions.ts", srcRoot).href);

const idle = { status: "idle" as const, message: "" };

beforeEach(() => {
  operations.length = 0;
  revalidated.length = 0;
  role = "editor";
  createClientCalls = 0;
  opportunityResult = {
    data: {
      stage_id: "stage-a",
      pipeline_stages: { is_active: true, outcome: null },
    },
    error: null,
  };
  stageResult = {
    data: { id: "stage-b", name: "Qualified", outcome: null, is_active: true },
    error: null,
  };
  opportunityUpdateResult = { data: { id: "opportunity-1" }, error: null };
  taskUpdateResult = { data: { id: "task-1", opportunity_id: "opportunity-1" }, error: null };
  taskCurrentResult = { data: { status: "completed", opportunity_id: "opportunity-1" }, error: null };
});

function moveForm() {
  const formData = new FormData();
  formData.set("opportunity_id", "opportunity-1");
  formData.set("provider_id", "provider-1");
  formData.set("expected_stage_id", "stage-a");
  formData.set("stage_id", "stage-b");
  return formData;
}

function completionForm() {
  const formData = new FormData();
  formData.set("action_id", "task-1");
  formData.set("provider_id", "provider-1");
  return formData;
}

test("pipeline inline action enforces ownership and compare-and-set before success", async () => {
  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.deepEqual(result, { status: "success", message: "Moved to Qualified." });
  assert.equal(createClientCalls, 1);
  assert.deepEqual(operations, [
    {
      table: "opportunities",
      kind: "select",
      columns: "stage_id, pipeline_stages(is_active, outcome)",
      filters: [["id", "opportunity-1"], ["provider_id", "provider-1"]],
    },
    {
      table: "pipeline_stages",
      kind: "select",
      columns: "id, name, outcome, is_active",
      filters: [["id", "stage-b"]],
    },
    {
      table: "opportunities",
      kind: "update",
      payload: { stage_id: "stage-b", closed_lost_reason: null },
      filters: [
        ["id", "opportunity-1"],
        ["provider_id", "provider-1"],
        ["stage_id", "stage-a"],
      ],
    },
  ]);
  assert.deepEqual(revalidated, [
    "/providers/provider-1",
    "/pipeline",
    "/customers",
    "/dashboard",
    "/opportunities/opportunity-1",
  ]);
});

test("pipeline inline action rejects terminal stages and rolls the board back", async () => {
  stageResult.data = { id: "stage-b", name: "Closed Won", outcome: "won", is_active: true };

  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /Close Won or Lost from the opportunity workspace/);
  assert.equal(operations.some((operation) => operation.kind === "update"), false);
  assert.deepEqual(revalidated, []);
});

test("pipeline inline action detects a concurrent move and refreshes authoritative state", async () => {
  opportunityUpdateResult.data = null;

  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /changed elsewhere/);
  assert.deepEqual(revalidated, ["/pipeline"]);
});

test("pipeline inline action rejects a stale board before attempting an update", async () => {
  opportunityResult.data = {
    stage_id: "stage-c",
    pipeline_stages: { is_active: true, outcome: null },
  };

  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /changed elsewhere/);
  assert.equal(operations.some((operation) => operation.kind === "update"), false);
  assert.deepEqual(revalidated, ["/pipeline"]);
});

test("pipeline inline action cannot reopen an opportunity closed before the pre-read", async () => {
  opportunityResult.data = {
    stage_id: "closed-won",
    pipeline_stages: { is_active: true, outcome: "won" },
  };

  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /changed elsewhere/);
  assert.equal(operations.some((operation) => operation.kind === "update"), false);
  assert.deepEqual(revalidated, ["/pipeline"]);
});

test("pipeline inline action rejects a current source stage that became terminal", async () => {
  const formData = moveForm();
  formData.set("expected_stage_id", "closed-won");
  opportunityResult.data = {
    stage_id: "closed-won",
    pipeline_stages: { is_active: true, outcome: "won" },
  };

  const result = await moveOpportunityStageInline(idle, formData);

  assert.equal(result.status, "error");
  assert.match(result.message, /no longer in an active pipeline stage/);
  assert.equal(operations.some((operation) => operation.kind === "update"), false);
  assert.deepEqual(revalidated, ["/pipeline"]);
});

test("pipeline inline action rejects a current source stage that became inactive", async () => {
  opportunityResult.data = {
    stage_id: "stage-a",
    pipeline_stages: { is_active: false, outcome: null },
  };

  const result = await moveOpportunityStageInline(idle, moveForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /no longer in an active pipeline stage/);
  assert.equal(operations.some((operation) => operation.kind === "update"), false);
  assert.deepEqual(revalidated, ["/pipeline"]);
});

test("pipeline inline action fails closed on duplicate identity fields", async () => {
  const formData = moveForm();
  formData.append("provider_id", "provider-2");

  const result = await moveOpportunityStageInline(idle, formData);

  assert.equal(result.status, "error");
  assert.match(result.message, /incomplete/);
  assert.deepEqual(operations, []);
});

test("pipeline inline action fails closed on duplicate expected stage fields", async () => {
  const formData = moveForm();
  formData.append("expected_stage_id", "stage-c");

  const result = await moveOpportunityStageInline(idle, formData);

  assert.equal(result.status, "error");
  assert.match(result.message, /incomplete/);
  assert.deepEqual(operations, []);
});

test("task inline action completes an open task once and refreshes its consumers", async () => {
  const formData = completionForm();
  formData.set("opportunity_id", "../../data-health");
  const result = await completeNextActionInline(idle, formData);

  assert.deepEqual(result, { status: "success", message: "Task completed." });
  assert.equal(operations.length, 1);
  assert.equal(operations[0].kind, "update");
  assert.equal(operations[0].columns, undefined);
  assert.deepEqual(operations[0].filters, [
    ["id", "task-1"],
    ["provider_id", "provider-1"],
    ["status", "open"],
  ]);
  assert.equal(typeof operations[0].payload?.completed_at, "string");
  assert.deepEqual(revalidated, [
    "/providers/provider-1",
    "/opportunities/opportunity-1",
    "/pipeline",
    "/dashboard",
    "/tasks",
  ]);
});

test("a sequential duplicate task completion is idempotent", async () => {
  taskUpdateResult.data = null;
  taskCurrentResult.data = { status: "completed", opportunity_id: "opportunity-1" };

  const result = await completeNextActionInline(idle, completionForm());

  assert.deepEqual(result, { status: "success", message: "Task was already complete." });
  assert.deepEqual(operations.map(({ kind }) => kind), ["update", "select"]);
  assert.equal(operations.filter(({ kind }) => kind === "update").length, 1);
  assert.equal(operations[1].columns, "status, opportunity_id");
});

test("a missing task returns an error so the optimistic row can roll back", async () => {
  taskUpdateResult.data = null;
  taskCurrentResult.data = null;

  const result = await completeNextActionInline(idle, completionForm());

  assert.equal(result.status, "error");
  assert.match(result.message, /no longer available/);
  assert.deepEqual(revalidated, ["/tasks"]);
});

test("viewers are rejected before a database client is created", async () => {
  role = "viewer";

  const [moveResult, taskResult] = await Promise.all([
    moveOpportunityStageInline(idle, moveForm()),
    completeNextActionInline(idle, completionForm()),
  ]);

  assert.equal(moveResult.status, "error");
  assert.equal(taskResult.status, "error");
  assert.equal(createClientCalls, 0);
  assert.deepEqual(operations, []);
});
