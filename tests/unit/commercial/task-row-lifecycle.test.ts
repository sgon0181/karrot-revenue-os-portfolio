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
const accountActionMock = mock.module(
  new URL("features/accounts/server/actions.ts", srcRoot),
  { namedExports: { async rescheduleNextAction() {} } },
);
const inlineActionMock = mock.module(
  new URL("features/commercial/server/inline-actions.ts", srcRoot),
  {
    namedExports: {
      async completeNextActionInline(_state: unknown, formData: FormData) {
        return new Promise<ActionResult>((resolve) => {
          requests.push({ formData, resolve });
        });
      },
    },
  },
);

const browser = new Window({ url: "https://karrot.local/tasks?filter=open" });
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
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

after(() => {
  inlineActionMock.restore();
  accountActionMock.restore();
  linkMock.restore();
  hooks.deregister();
  browser.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const { TaskRow } = await import(
  new URL("features/commercial/components/task-row.tsx", srcRoot).href
);
const { TaskCompletionBoundary } = await import(
  new URL("features/commercial/components/task-completion-boundary.tsx", srcRoot).href
);

function task(status = "open") {
  return {
    id: "task-1",
    provider_id: "provider-1",
    opportunity_id: "opportunity-1",
    title: "Call Example Care",
    status,
    record_mode: "sandbox",
    priority: "high",
    due_at: "2026-08-25T00:00:00.000Z",
    providers: { business_name: "Example Care" },
    opportunities: {
      name: "Example opportunity",
      pipeline_stages: { name: "Discovery" },
    },
  };
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
  setActEnvironment(false);
  button.click();
  await settle();
  setActEnvironment(true);
}

function controls() {
  const row = browser.document.querySelector("article");
  assert.ok(row instanceof browser.HTMLElement);
  const completeButton = Array.from(row.querySelectorAll("button")).find((button) => (
    button.textContent?.includes("Complete") || button.textContent?.includes("Completing")
  ));
  const rescheduleButton = Array.from(row.querySelectorAll("button")).find((button) => (
    button.textContent?.includes("Reschedule")
  ));
  assert.ok(completeButton instanceof browser.HTMLButtonElement);
  assert.ok(rescheduleButton instanceof browser.HTMLButtonElement);
  return { row, completeButton, rescheduleButton };
}

function lifecycleView(showRow: boolean) {
  return createElement(
    TaskCompletionBoundary,
    null,
    createElement(
      "nav",
      { "aria-label": "Task filters" },
      createElement("a", { href: "/tasks?filter=open", "aria-current": "page" }, "All open"),
    ),
    showRow
      ? createElement(TaskRow, {
        task: task(),
        sectionKey: "overdue",
        origin: "/tasks?filter=open",
      })
      : null,
  );
}

test("Task Complete preserves controls, status and focus through pending, rollback and success", async () => {
  requests.length = 0;
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(lifecycleView(true));
    });
    let current = controls();
    const liveRegion = browser.document.querySelector("[aria-live='polite'][aria-atomic='true']");
    assert.ok(liveRegion instanceof browser.HTMLElement);
    current.completeButton.focus();
    await submitWhileKeepingTheServerPending(current.completeButton);

    assert.equal(requests.length, 1);
    assert.equal(requests[0].formData.get("action_id"), "task-1");
    current = controls();
    assert.equal(current.completeButton.disabled, true, "Complete stays mounted and disabled");
    const pendingRescheduleGroup = current.rescheduleButton.closest("fieldset");
    assert.ok(pendingRescheduleGroup instanceof browser.HTMLFieldSetElement);
    assert.equal(pendingRescheduleGroup.disabled, true, "Reschedule stays mounted in a disabled group");
    assert.match(current.row.querySelector("a")?.className ?? "", /line-through/, "the row styles completed optimistically");
    assert.match(liveRegion.textContent ?? "", /Completing Call Example Care\./);

    current.completeButton.click();
    assert.equal(requests.length, 1, "disabled Complete blocks rapid repeat input");

    await act(async () => {
      requests[0].resolve({ status: "error", message: "Completion rejected by the server." });
      await Promise.resolve();
    });
    await settle();

    current = controls();
    assert.equal(current.completeButton.disabled, false);
    const settledRescheduleGroup = current.rescheduleButton.closest("fieldset");
    assert.ok(settledRescheduleGroup instanceof browser.HTMLFieldSetElement);
    assert.equal(settledRescheduleGroup.disabled, false);
    assert.doesNotMatch(current.row.querySelector("a")?.className ?? "", /line-through/);
    assert.equal(browser.document.activeElement, current.completeButton, "an error restores focus to Complete");
    assert.equal(browser.document.querySelector("[aria-live='polite']"), liveRegion, "the live region remains mounted");
    assert.match(liveRegion.textContent ?? "", /Completion rejected by the server\./);

    await submitWhileKeepingTheServerPending(current.completeButton);
    assert.equal(requests.length, 2);
    current = controls();
    assert.match(current.row.querySelector("a")?.className ?? "", /line-through/);

    await act(async () => {
      requests[1].resolve({ status: "success", message: "Task completed." });
      await Promise.resolve();
      root.render(lifecycleView(false));
    });
    await settle();

    assert.equal(browser.document.querySelector("article"), null, "settled success removes the completed row");
    assert.equal(browser.document.querySelector("[aria-live='polite']"), liveRegion, "the result region survives row removal");
    assert.match(liveRegion.textContent ?? "", /Task completed\./);
    const currentFilter = browser.document.querySelector('[aria-label="Task filters"] [aria-current="page"]');
    assert.ok(currentFilter instanceof browser.HTMLAnchorElement);
    assert.equal(browser.document.activeElement, currentFilter, "success moves focus to the persistent current filter");
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

test("Task Complete keeps error feedback and safe focus when the failed row is removed", async () => {
  requests.length = 0;
  const container = browser.document.createElement("div");
  browser.document.body.append(container);
  const root = createRoot(container as unknown as Element);

  try {
    await act(async () => {
      root.render(lifecycleView(true));
    });
    const current = controls();
    const liveRegion = browser.document.querySelector("[aria-live='polite'][aria-atomic='true']");
    assert.ok(liveRegion instanceof browser.HTMLElement);
    current.completeButton.focus();
    await submitWhileKeepingTheServerPending(current.completeButton);

    await act(async () => {
      requests[0].resolve({ status: "error", message: "The task is no longer available." });
      await Promise.resolve();
      root.render(lifecycleView(false));
    });
    await settle();

    assert.equal(browser.document.querySelector("article"), null);
    assert.equal(browser.document.querySelector("[aria-live='polite']"), liveRegion);
    assert.match(liveRegion.textContent ?? "", /The task is no longer available\./);
    const currentFilter = browser.document.querySelector('[aria-label="Task filters"] [aria-current="page"]');
    assert.ok(currentFilter instanceof browser.HTMLAnchorElement);
    assert.equal(browser.document.activeElement, currentFilter, "removed-row error uses the persistent fallback target");
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
