"use client";

import { useEffect, useRef } from "react";
import { withInheritedHash } from "@/shared/lib/internal-navigation";

/**
 * Carries a validated internal return target through a server action. Fragments
 * never reach a server-rendered page, so inherit the current browser fragment
 * when the supplied target does not already own one.
 */
export function InternalReturnToInput({
  returnTo,
  name = "return_to",
}: {
  returnTo: string;
  name?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const returnToWithInheritedFragment = withInheritedHash(
      returnTo,
      window.location.hash,
    );
    if (returnToWithInheritedFragment && inputRef.current) {
      inputRef.current.value = returnToWithInheritedFragment;
    }
  }, [returnTo]);

  return (
    <input
      ref={inputRef}
      type="hidden"
      name={name}
      defaultValue={returnTo}
    />
  );
}
