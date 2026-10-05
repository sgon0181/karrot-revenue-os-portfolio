"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

export function DisclosureDialog({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="button-secondary whitespace-nowrap" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#082f23]/35 p-4 backdrop-blur-[1px] animate-fade-in" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="animate-drawer-in flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-[9px] border border-[#bcd8ca] bg-white shadow-[0_20px_60px_rgba(8,47,35,0.26)]">
            <header className="panel-header shrink-0">
              <div>
                <p className="section-kicker mb-0.5">Workspace record</p>
                <h2 id={titleId} className="text-base font-semibold text-[#244136]">{label}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="icon-button bg-white" aria-label={`Close ${label}`}><X className="size-[18px]" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6faf8] p-4 sm:p-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
