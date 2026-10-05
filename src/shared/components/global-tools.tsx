"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

function SearchField() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";

  return (
    <form action="/search" className="relative hidden w-full max-w-[520px] md:block" role="search" aria-label="Search Revenue OS">
      <label htmlFor="global-search" className="sr-only">Search providers, facilities, contacts, opportunities and customers</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64726c]" />
      <input
        key={routeQuery}
        id="global-search"
        name="q"
        defaultValue={routeQuery}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        className="h-10 w-full rounded-[6px] border border-[#dce6e1] bg-[#f7faf8] pl-9 pr-24 text-sm text-[#1b2f27] outline-none transition focus:border-[#2f7a58] focus:bg-white focus:ring-3 focus:ring-[#2f7a58]/10"
        placeholder="Search names, places, ABNs or Site IDs"
      />
      <button
        type="submit"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#d5dfda] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#64726c] transition hover:border-[#93b9a7] hover:text-[#225f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7a58]/30"
        aria-label="Run global search"
      >
        Enter
      </button>
    </form>
  );
}

function SearchFieldFallback() {
  return <div className="hidden h-10 w-full max-w-[520px] rounded-[6px] border border-[#dce6e1] bg-[#f7faf8] md:block" aria-hidden="true" />;
}

export function GlobalTools() {
  return (
    <>
      <Suspense fallback={<SearchFieldFallback />}>
        <SearchField />
      </Suspense>

      <div className="ml-auto flex items-center md:hidden">
        <Link
          href="/search"
          className="icon-button"
          aria-label="Search Revenue OS"
        >
          <Search aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
    </>
  );
}
