import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { after, mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import ts from "typescript";

const srcRoot = pathToFileURL(`${process.cwd()}/src/`);

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const relative = specifier.slice(2);
      for (const extension of [".ts", ".tsx"]) {
        const candidate = new URL(`${relative}${extension}`, srcRoot);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    if (specifier === "next/link") return nextResolve("next/link.js", context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(srcRoot.href) && (url.endsWith(".ts") || url.endsWith(".tsx"))) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(source, {
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
          fileName: fileURLToPath(url),
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

type ActionResult = { status: "success" | "error"; message: string };
type PendingRequest = {
  formData: FormData;
  resolve: (result: ActionResult) => void;
};

const requests: PendingRequest[] = [];
const visibilityRequests: Array<{
  id: string;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}> = [];
const linkMock = mock.module("next/link.js", {
  defaultExport({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return createElement("a", { href, className }, children);
  },
});
const actionMock = mock.module(
  new URL("features/commercial/server/inline-actions.ts", srcRoot),
  {
    namedExports: {
      async moveOpportunityStageInline(_state: unknown, formData: FormData) {
        return new Promise<ActionResult>((resolve) => {
          requests.push({ formData, resolve });
        });
      },
    },
  },
);

const browser = new Window({ url: "https://karrot.local/pipeline" });
browser.requestAnimationFrame = (callback: FrameRequestCallback) => {
  callback(Date.now());
  return setImmediate(() => undefined);
};
browser.cancelAnimationFrame = (handle) => clearImmediate(handle);
browser.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
  const scrollOptions = typeof options === "object" ? options : undefined;
  const viewport = this.closest("[role='region']");
  const stage = this.closest("section[aria-labelledby^='stage-']");
  if (viewport instanceof browser.HTMLElement) {
    viewport.scrollLeft = stage?.getAttribute("aria-labelledby") === "stage-stage-b" ? 300 : 0;
  }
  visibilityRequests.push({
    id: this.id,
    block: scrollOptions?.block,
    inline: scrollOptions?.inline,
  });
};
const previousGlobals = new Map<PropertyKey, PropertyDescriptor | undefined>();
for (const [key, value] of Object.entries({
  window: browser,
  document: browser.document,
  navigator: browser.navigator,
  HTMLElement: browser.HTMLElement,
  HTMLFormElement: browser.HTMLFormElement,
  FormData: browser.FormData,
  Event: browser.Event,
  MouseEvent: browser.MouseEvent,
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

after(() => {
  actionMock.restore();
  linkMock.restore();
  hooks.deregister();
  browser.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const { PipelineBoard } = await import(
  new URL("features/commercial/components/pipeline-board.tsx", srcRoot).href
);

const stages = [
  {
    id: "stage-a",
    code: "discovery",
    name: "Discovery",
    color: "#134b35",
    position: 1,
    outcome: null,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "stage-b",
    code: "qualified",
    name: "Qualified",
    color: "#35785d",
    position: 2,
    outcome: null,
    is_active: true,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  },
];

function opportunity(stageId: string) {
  return {
    id: "opportunity-1",
    provider_id: "provider-1",
    provider_name: "Example Care",
    stage_id: stageId,
    stage_name: stageId === "stage-a" ? "Discovery" : "Qualified",
    stage_code: stageId === "stage-a" ? "discovery" : "qualified",
    stage_color: stageId === "stage-a" ? "#134b35" : "#35785d",
    stage_position: stageId === "stage-a" ? 1 : 2,
    name: "Example opportunity",
    record_mode: "sandbox",
    days_in_stage: 2,
    estimated_value: 10_000,
    primary_contact_name: "Casey Example",
    last_activity_at: null,
    days_since_last_activity: null,
    next_action: null,
    next_action_due_at: null,
    next_action_overdue: false,
    blockers: null,
  };
}

function cardStage() {
  const card = browser.document.getElementById("opportunity-card-opportunity-1");
  assert.ok(card);
  const stage = card.closest("section[aria-labelledby^='stage-']");
  assert.ok(stage);
  return stage.querySelector("h3")?.textContent;
}

function moveControls() {
  const card = browser.document.getElementById("opportunity-card-opportunity-1");
  assert.ok(card);
  const select = card.querySelector("select");
  const button = card.querySelector("button[type='submit']");
  assert.ok(select instanceof browser.HTMLSelectElement);
  assert.ok(button instanceof browser.HTMLButtonElement);
  return { card, select, button };
}

async function settle() {
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

function setActEnvironment(value: boolean) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = value;
}

async function submitWhileKeepingTheServerPending(button: { click(): void }) {
  // A pending React form action cannot be awaited inside act() until its
  // controlled server promise settles. Disable act diagnostics only while we
  // intentionally inspect that real intermediate UI state.
  setActEnvironment(false);
  button.click();
  await settle();
  setActEnvironment(true);
}

test("Pipeline collapses empty stages and reveals the first populated stage", async () => {
  visibilityRequests.length = 0;
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(createElement(PipelineBoard, {
        stages,
        opportunities: [opportunity("stage-b")],
        canEdit: true,
      }));
    });

    const collapsedStage = container.querySelector("[data-pipeline-stage-populated='false']");
    const populatedStage = container.querySelector("[data-pipeline-stage-populated='true']");
    assert.ok(collapsedStage instanceof browser.HTMLElement);
    assert.ok(populatedStage instanceof browser.HTMLElement);
    assert.match(collapsedStage.className, /\bw-12\b/, "an empty stage is a 48px marker");
    assert.match(collapsedStage.textContent, /Discovery/);
    assert.match(collapsedStage.textContent, /0/);
    assert.doesNotMatch(collapsedStage.textContent, /No opportunities in this stage/);
    assert.match(
      populatedStage.className,
      /w-\[min\(88vw,300px\)\]/,
      "a populated stage keeps its existing 300px-responsive width",
    );
    assert.deepEqual(visibilityRequests.at(-1), {
      id: "stage-column-stage-b",
      block: "nearest",
      inline: "start",
    }, "the first populated stage is aligned into the board viewport on mount");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("Pipeline does not attempt an initial stage scroll when every stage is empty", async () => {
  visibilityRequests.length = 0;
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(createElement(PipelineBoard, {
        stages,
        opportunities: [],
        canEdit: true,
      }));
    });

    assert.equal(visibilityRequests.length, 0);
    assert.equal(container.querySelector("[role='region']"), null);
    assert.match(container.textContent, /No active opportunities yet/);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("Pipeline Move keeps lifecycle state through relocation, rollback and success", async () => {
  requests.length = 0;
  visibilityRequests.length = 0;
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(createElement(PipelineBoard, {
        stages,
        opportunities: [opportunity("stage-a")],
        canEdit: true,
      }));
    });
    assert.equal(cardStage(), "Discovery");
    const boardViewport = browser.document.querySelector("[role='region']");
    assert.ok(boardViewport instanceof browser.HTMLElement);
    Object.defineProperties(boardViewport, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 600 },
    });
    boardViewport.scrollLeft = 0;

    let controls = moveControls();
    controls.select.value = "stage-b";
    await submitWhileKeepingTheServerPending(controls.button);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].formData.get("stage_id"), "stage-b");
    assert.equal(
      requests[0].formData.get("expected_stage_id"),
      "stage-a",
      "the request carries the stage rendered before the optimistic relocation",
    );
    assert.equal(cardStage(), "Qualified", "the card relocates before the request resolves");
    controls = moveControls();
    assert.equal(controls.button.disabled, true, "the replacement control stays locked");
    assert.equal(controls.select.disabled, true);
    assert.equal(browser.document.activeElement, controls.card, "focus follows the relocated card");
    assert.deepEqual(visibilityRequests.at(-1), {
      id: "opportunity-card-opportunity-1",
      block: "nearest",
      inline: "nearest",
    }, "the relocated card is made visible before focus is restored");
    assert.equal(boardViewport.scrollLeft, 300, "the off-screen target column enters the narrow viewport");
    assert.match(browser.document.body.textContent, /Moving Example opportunity\./);

    assert.equal(controls.button.matches(":disabled"), true);
    await submitWhileKeepingTheServerPending(controls.button);
    assert.equal(requests.length, 1, "the pending lock prevents rapid repeat input");

    await act(async () => {
      requests[0].resolve({ status: "error", message: "Move rejected by the server." });
      await Promise.resolve();
    });
    await settle();

    assert.equal(cardStage(), "Discovery", "an error restores the authoritative stage");
    controls = moveControls();
    assert.equal(controls.button.disabled, false);
    assert.match(controls.card.textContent, /Move rejected by the server\./);
    assert.match(
      browser.document.querySelector("[aria-live='polite'][aria-atomic='true']")?.textContent ?? "",
      /Move rejected by the server\./,
    );
    assert.equal(browser.document.activeElement, controls.card, "focus returns with the rolled-back card");
    assert.equal(boardViewport.scrollLeft, 0, "rollback returns the originating column to the viewport");

    controls.select.value = "stage-b";
    await submitWhileKeepingTheServerPending(controls.button);
    assert.equal(requests.length, 2);
    assert.equal(cardStage(), "Qualified");

    await act(async () => {
      requests[1].resolve({ status: "success", message: "Moved to Qualified." });
      await Promise.resolve();
      root.render(createElement(PipelineBoard, {
        stages,
        opportunities: [opportunity("stage-b")],
        canEdit: true,
      }));
    });
    await settle();

    assert.equal(cardStage(), "Qualified");
    controls = moveControls();
    assert.equal(controls.button.disabled, false);
    assert.match(controls.card.textContent, /Moved to Qualified\./);
    assert.equal(browser.document.activeElement, controls.card);
  } finally {
    setActEnvironment(true);
    for (const request of requests) {
      request.resolve({ status: "error", message: "Test cleanup." });
    }
    await settle();
    await act(async () => root.unmount());
    container.remove();
  }
});
