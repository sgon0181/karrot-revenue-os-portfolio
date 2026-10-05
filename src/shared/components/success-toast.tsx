"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

export function SuccessToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleDismiss = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setVisible(false), 5000);
  }, [clearTimer]);

  useEffect(() => {
    scheduleDismiss();
    return clearTimer;
  }, [clearTimer, scheduleDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed right-4 top-[76px] z-[75] flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-[8px] border border-[#a8d8bd] bg-white p-3.5 shadow-[0_14px_38px_rgba(8,47,35,0.18)] animate-drawer-in" role="status" aria-live="polite" onMouseEnter={clearTimer} onMouseLeave={scheduleDismiss} onFocusCapture={clearTimer} onBlurCapture={scheduleDismiss}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#dff8ec] text-[#15834b]"><CheckCircle2 className="size-[18px]" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#244136]">Saved to workspace</p><p className="mt-0.5 text-xs leading-5 text-[#64726c]">{message}</p></div>
      <button type="button" onClick={() => setVisible(false)} className="icon-button size-8" aria-label="Dismiss notification"><X className="size-4" /></button>
    </div>
  );
}

export function ErrorToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleDismiss = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setVisible(false), 10_000);
  }, [clearTimer]);

  useEffect(() => {
    scheduleDismiss();
    return clearTimer;
  }, [clearTimer, scheduleDismiss]);

  if (!visible) return null;
  const title = message.toLowerCase().includes("already running")
    ? "Research already in progress"
    : "Research did not complete";

  return (
    <div className="fixed right-4 top-[76px] z-[75] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-[8px] border border-rose-200 bg-white p-3.5 shadow-[0_14px_38px_rgba(8,47,35,0.18)] animate-drawer-in" role="alert" onMouseEnter={clearTimer} onMouseLeave={scheduleDismiss} onFocusCapture={clearTimer} onBlurCapture={scheduleDismiss}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-700"><TriangleAlert className="size-[18px]" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#5e2630]">{title}</p><p className="mt-0.5 text-xs leading-5 text-[#74515a]">{message}</p></div>
      <button type="button" onClick={() => setVisible(false)} className="icon-button size-8" aria-label="Dismiss notification"><X className="size-4" /></button>
    </div>
  );
}
