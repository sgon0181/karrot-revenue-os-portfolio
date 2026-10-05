"use client";

import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";

export function CommercialErrorToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 10_000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed right-4 top-[76px] z-[75] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-[8px] border border-rose-200 bg-white p-3.5 shadow-[0_14px_38px_rgba(8,47,35,0.18)] animate-drawer-in" role="alert">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-700"><TriangleAlert className="size-[18px]" /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#5e2630]">Change not saved</p><p className="mt-0.5 text-xs leading-5 text-[#74515a]">{message}</p></div>
      <button type="button" onClick={() => setVisible(false)} className="icon-button size-8" aria-label="Dismiss notification"><X className="size-4" /></button>
    </div>
  );
}
