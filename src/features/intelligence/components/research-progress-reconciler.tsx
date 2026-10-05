"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RESEARCH_STARTED_EVENT } from "@/features/intelligence/lib/research-events";

type ReconcileResponse = {
  active: boolean;
  transitioned: Array<{ providerId: string; status: "completed" | "failed" }>;
};

const ACTIVE_POLL_MS = 3_500;
const RETRY_POLL_MS = 8_000;
const DISPATCH_POLL_MS = 1_000;
const DISPATCH_GRACE_MS = 30_000;

export function ResearchProgressReconciler({ active }: { active: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let shouldPoll = active;
    let dispatchGraceUntil = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reconcile(), delay);
    };

    const reconcile = async () => {
      if (stopped || inFlight) return;
      timer = null;
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/intelligence/research/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (stopped) return;
        if (!response.ok) {
          if (shouldPoll || Date.now() < dispatchGraceUntil) schedule(RETRY_POLL_MS);
          return;
        }
        const result = await response.json() as ReconcileResponse;
        if (stopped) return;
        const currentProviderTransitioned = result.transitioned.some(
          ({ providerId }) => pathnameRef.current === `/providers/${providerId}`,
        );
        // Refresh only the workspace whose research changed. An operator using
        // another screen may be midway through a form and should not be
        // disturbed merely because background research completed elsewhere.
        if (currentProviderTransitioned) router.refresh();
        shouldPoll = result.active;
        if (result.active) {
          schedule(ACTIVE_POLL_MS);
        } else if (Date.now() < dispatchGraceUntil) {
          schedule(DISPATCH_POLL_MS);
        }
      } catch {
        if (!stopped && (shouldPoll || Date.now() < dispatchGraceUntil)) schedule(RETRY_POLL_MS);
      } finally {
        inFlight = false;
        controller = null;
      }
    };

    const wake = () => {
      shouldPoll = true;
      dispatchGraceUntil = Date.now() + DISPATCH_GRACE_MS;
      schedule(0);
    };

    const reconcileWhenAvailable = () => {
      if (document.visibilityState !== "visible") return;
      if (shouldPoll || Date.now() < dispatchGraceUntil) schedule(0);
    };

    window.addEventListener(RESEARCH_STARTED_EVENT, wake);
    window.addEventListener("online", reconcileWhenAvailable);
    document.addEventListener("visibilitychange", reconcileWhenAvailable);
    if (active) schedule(0);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      window.removeEventListener(RESEARCH_STARTED_EVENT, wake);
      window.removeEventListener("online", reconcileWhenAvailable);
      document.removeEventListener("visibilitychange", reconcileWhenAvailable);
    };
  }, [active, router]);

  return null;
}
