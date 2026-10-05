import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  internalPathLabel,
  validatedInternalPath,
} from "@/shared/lib/internal-navigation";

export function ContextBreadcrumbs({
  currentLabel,
  returnTo,
  fallbackHref,
  fallbackLabel,
}: {
  currentLabel: string;
  returnTo?: string | null;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const safeOrigin = validatedInternalPath(returnTo);
  const parentHref = safeOrigin ?? fallbackHref;
  const parentLabel = internalPathLabel(safeOrigin) ?? fallbackLabel;
  const parentIsHome = parentHref === "/" || parentHref === "/dashboard";

  return (
    <nav aria-label="Breadcrumb" className="mb-3 min-w-0 text-xs font-semibold text-[#64726c]">
      <ol className="flex w-full min-w-0 items-center gap-1.5">
        {!parentIsHome ? (
          <>
            <li><Link href="/dashboard" className="rounded-[4px] hover:text-[#1f6548] hover:underline">Home</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
          </>
        ) : null}
        <li className="min-w-0 max-w-[45%]">
          <Link href={parentHref} className="block truncate rounded-[4px] hover:text-[#1f6548] hover:underline">
            {parentLabel}
          </Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>
        <li aria-current="page" className="min-w-0 flex-1 truncate text-[#385348]">{currentLabel}</li>
      </ol>
    </nav>
  );
}
