import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import {
  ProviderFacilitiesSection,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/accounts/components/provider-facilities-section.ts";
import {
  focusWorkspaceAnchorWhenReady,
  type WorkspaceDomEnvironment,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/accounts/lib/provider-workspace-dom.ts";
import {
  providerWorkspaceSectionIds,
  resolveProviderWorkspaceLocation,
// Node's type-stripping test runner requires a TypeScript extension.
// @ts-expect-error direct test import
} from "../../../src/features/accounts/lib/provider-workspace-tabs.ts";

function dom() {
  const browser = new Window({ url: "https://karrot.local/providers/provider-1" });
  const environment = {
    document: browser.document,
    window: browser,
    MutationObserver: browser.MutationObserver,
    HTMLElement: browser.HTMLElement,
  } as unknown as WorkspaceDomEnvironment;
  return { browser, environment };
}

function settle(browser: Window) {
  return new Promise<void>((resolve) => browser.setTimeout(resolve, 80));
}

function renderFacilities(browser: Window) {
  browser.document.body.innerHTML = renderToStaticMarkup(
    createElement(
      ProviderFacilitiesSection,
      null,
      createElement("h2", null, "Facilities"),
    ),
  );
  return browser.document.getElementById(providerWorkspaceSectionIds.facilities)!;
}

test("#facilities selects Overview and focuses the rendered Facilities section once", async () => {
  const { browser, environment } = dom();
  try {
    const resolution = resolveProviderWorkspaceLocation(
      "tab=people&facility=facility-1&returnTo=%2Fcustomers",
      "#facilities",
    );
    const target = renderFacilities(browser);
    const scrollCalls: ScrollIntoViewOptions[] = [];
    target.scrollIntoView = (options) => {
      scrollCalls.push(options as ScrollIntoViewOptions);
    };
    let focusedCount = 0;

    focusWorkspaceAnchorWhenReady(
      resolution.anchorId!,
      () => {
        focusedCount += 1;
      },
      environment,
    );
    await settle(browser);

    assert.equal(resolution.tab, "overview");
    assert.equal(
      resolution.search,
      "tab=overview&facility=facility-1&returnTo=%2Fcustomers",
    );
    assert.equal(resolution.hash, "#facilities");
    assert.equal(resolution.anchorId, providerWorkspaceSectionIds.facilities);
    assert.equal(browser.document.activeElement, target);
    assert.equal(target.localName, "section");
    assert.equal(target.querySelector("h2")?.textContent, "Facilities");
    assert.equal(target.getAttribute("tabindex"), "-1");
    assert.deepEqual(scrollCalls, [
      { behavior: "auto", block: "start", inline: "nearest" },
    ]);
    assert.equal(focusedCount, 1);

    const input = browser.document.createElement("input");
    browser.document.body.append(input);
    input.focus();
    assert.equal(target.hasAttribute("tabindex"), false);

    browser.document.body.append(browser.document.createElement("div"));
    await settle(browser);
    assert.equal(browser.document.activeElement, input);
    assert.equal(scrollCalls.length, 1);
    assert.equal(focusedCount, 1);
  } finally {
    browser.close();
  }
});

test("deep-link focus yields when user focus predates helper startup", async () => {
  const { browser, environment } = dom();
  try {
    const target = renderFacilities(browser);
    let scrolled = false;
    target.scrollIntoView = () => {
      scrolled = true;
    };
    const input = browser.document.createElement("input");
    browser.document.body.prepend(input);
    input.focus();
    let focusedCount = 0;

    focusWorkspaceAnchorWhenReady(
      providerWorkspaceSectionIds.facilities,
      () => {
        focusedCount += 1;
      },
      environment,
    );
    await settle(browser);

    assert.equal(browser.document.activeElement, input);
    assert.equal(scrolled, false);
    assert.equal(focusedCount, 0);
  } finally {
    browser.close();
  }
});

for (const cancellation of ["focus", "input", "navigation"] as const) {
  test(`pending deep-link focus yields to user ${cancellation}`, async () => {
    const { browser, environment } = dom();
    try {
      const input = browser.document.createElement("input");
      browser.document.body.append(input);
      let focusedCount = 0;

      focusWorkspaceAnchorWhenReady(
        providerWorkspaceSectionIds.facilities,
        () => {
          focusedCount += 1;
        },
        environment,
      );

      if (cancellation === "focus") input.focus();
      if (cancellation === "input") {
        input.dispatchEvent(new browser.Event("input", { bubbles: true }));
      }
      if (cancellation === "navigation") {
        browser.dispatchEvent(new browser.PopStateEvent("popstate"));
      }

      const target = renderFacilities(browser);
      let scrolled = false;
      target.scrollIntoView = () => {
        scrolled = true;
      };
      await settle(browser);

      assert.notEqual(browser.document.activeElement, target);
      assert.equal(scrolled, false);
      assert.equal(focusedCount, 0);
    } finally {
      browser.close();
    }
  });
}
