"use client";

import { FileSearch, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { RESEARCH_STARTED_EVENT } from "@/features/intelligence/lib/research-events";

export function ResearchSubmitButton({
  label,
  pendingLabel,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  useEffect(() => {
    if (pending) window.dispatchEvent(new Event(RESEARCH_STARTED_EVENT));
  }, [pending]);

  return (
    <>
      <button className="button-primary" type="submit" disabled={isDisabled} aria-busy={isDisabled}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileSearch className="size-4" aria-hidden="true" />}
        {pending ? pendingLabel : label}
      </button>
      {pending ? (
        <p className="mt-2 max-w-sm text-xs leading-5 text-[#52635b]" role="status" aria-live="polite">
          Starting background public-source research. Once it is accepted, you can keep using this workspace while the brief is built.
        </p>
      ) : null}
    </>
  );
}
