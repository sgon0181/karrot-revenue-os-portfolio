"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "button-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  );
}
