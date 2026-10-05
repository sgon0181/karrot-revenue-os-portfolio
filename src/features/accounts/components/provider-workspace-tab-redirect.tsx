"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  resolveProviderWorkspaceLocation,
  type ProviderWorkspaceTab,
} from "@/features/accounts/lib/provider-workspace-tabs";
import { focusWorkspaceAnchorWhenReady } from "@/features/accounts/lib/provider-workspace-dom";

const workspaceTabNavSelector = 'nav[aria-label="Account workspace tabs"]';

function revealWorkspaceTab(nav: HTMLElement, tab: HTMLElement) {
  const navBounds = nav.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  let nextLeft: number | null = null;

  if (tabBounds.left < navBounds.left) {
    nextLeft = nav.scrollLeft + tabBounds.left - navBounds.left;
  } else if (tabBounds.right > navBounds.right) {
    nextLeft = nav.scrollLeft + tabBounds.right - navBounds.right;
  }

  if (nextLeft !== null) {
    nav.scrollTo({ left: Math.max(0, nextLeft), behavior: "auto" });
  }
}

function revealActiveWorkspaceTab(tab: ProviderWorkspaceTab) {
  const nav = document.querySelector<HTMLElement>(workspaceTabNavSelector);
  const activeTab = Array.from(nav?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])
    .find((link) => new URL(link.href).searchParams.get("tab") === tab)
    ?? nav?.querySelector<HTMLElement>('[aria-current="page"]');
  if (nav && activeTab) revealWorkspaceTab(nav, activeTab);
}

export function ProviderWorkspaceTabRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastReplacementRef = useRef("");
  const lastFocusedLocationRef = useRef("");
  const search = searchParams.toString();

  useEffect(() => {
    let focusFrame: number | null = null;
    let stopAnchorWait: (() => void) | null = null;

    const reconcileLocation = () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      stopAnchorWait?.();
      stopAnchorWait = null;

      const resolution = resolveProviderWorkspaceLocation(
        window.location.search,
        window.location.hash,
      );
      if (resolution.needsReplace) {
        const href = `${pathname}?${resolution.search}${resolution.hash}`;
        if (lastReplacementRef.current !== href) {
          lastReplacementRef.current = href;
          router.replace(href, { scroll: false });
        }
      } else {
        lastReplacementRef.current = "";
      }

      const locationKey = `${pathname}?${resolution.search}${resolution.hash}`;
      if (!resolution.anchorId) lastFocusedLocationRef.current = "";
      if (
        resolution.anchorId
        && lastFocusedLocationRef.current !== locationKey
      ) {
        stopAnchorWait = focusWorkspaceAnchorWhenReady(
          resolution.anchorId,
          () => {
            lastFocusedLocationRef.current = locationKey;
          },
        );
      }
      focusFrame = window.requestAnimationFrame(() => {
        // Next's client navigation may apply its own scroll/focus work on the
        // first frame. Reconcile on the following frame so the deep-link target
        // remains the final, keyboard-visible destination.
        focusFrame = window.requestAnimationFrame(() => {
          revealActiveWorkspaceTab(resolution.tab);
        });
      });
    };

    const nav = document.querySelector<HTMLElement>(workspaceTabNavSelector);
    const revealFocusedTab = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && nav?.contains(event.target)) {
        revealWorkspaceTab(nav, event.target);
      }
    };
    const restoreHistoryLocation = () => {
      lastFocusedLocationRef.current = "";
      reconcileLocation();
    };

    reconcileLocation();
    window.addEventListener("hashchange", reconcileLocation);
    window.addEventListener("popstate", restoreHistoryLocation);
    nav?.addEventListener("focusin", revealFocusedTab);
    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      stopAnchorWait?.();
      window.removeEventListener("hashchange", reconcileLocation);
      window.removeEventListener("popstate", restoreHistoryLocation);
      nav?.removeEventListener("focusin", revealFocusedTab);
    };
  }, [pathname, router, search]);

  return null;
}
