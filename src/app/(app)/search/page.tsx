import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ContactRound,
  MapPin,
  Search,
  UsersRound,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState, SectionTitle } from "@/shared/components/ui";
import { googleMapsSearchUrl } from "@/features/market/lib/maps";
import { createClient } from "@/infrastructure/supabase/server";
import { normaliseSearchQuery, searchPattern, searchResultHref } from "./search-helpers";
import { withReturnTo } from "@/shared/lib/internal-navigation";
import { loadSampleProviderIds, recordBelongsToVisibleAccount } from "@/features/accounts/server/provider-record-mode";

const groupOrder = ["provider", "facility", "contact", "opportunity", "customer"] as const;

const groupMeta = {
  provider: { label: "Providers", icon: Building2 },
  facility: { label: "Facilities", icon: MapPin },
  contact: { label: "Contacts", icon: ContactRound },
  opportunity: { label: "Opportunities", icon: Workflow },
  customer: { label: "Customers", icon: UsersRound },
};

function visibleSubtitle(
  item: { object_type: string | null; subtitle: string | null; provider_id: string | null },
  sampleProviderIds: ReadonlySet<string>,
) {
  if (!item.provider_id || !sampleProviderIds.has(item.provider_id)) return item.subtitle;
  if (item.object_type === "provider") return "CRM account";
  if (item.object_type === "facility") return item.subtitle?.split(" · Site ")[0] ?? "Recorded facility";
  return item.subtitle;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const normalisedQuery = normaliseSearchQuery(query);
  const origin = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  const pattern = searchPattern(query);
  const supabase = await createClient();
  const [result, sampleProviderIds] = await Promise.all([
    pattern
    ? supabase
        .from("v_global_search")
        .select("*")
        .ilike("search_text", pattern)
        .order("object_type")
        .order("title")
        .limit(100)
    : Promise.resolve({ data: [], error: null }),
    loadSampleProviderIds(supabase),
  ]);
  if (result.error) throw new Error(result.error.message);
  const results = (result.data ?? []).filter((item) =>
    recordBelongsToVisibleAccount(item.record_mode, item.provider_id, sampleProviderIds));

  return (
    <div>
      <PageHeader
        eyebrow="Providers · Universal search"
        title="Search Revenue OS"
        description="Find providers, facilities, contacts, opportunities and customers from one place."
      />

      <form action="/search" role="search" aria-label="Search Revenue OS" className="card mb-5 flex items-center gap-2 p-3 md:hidden">
        <Search aria-hidden="true" className="ml-1 size-4 shrink-0 text-[#64726c]" />
        <label htmlFor="search-page-query" className="sr-only">Search Revenue OS</label>
        <input
          id="search-page-query"
          className="input border-0 bg-transparent shadow-none focus:ring-0"
          name="q"
          defaultValue={query}
          placeholder="Try Randwick, Baptist, an ABN or a Site ID"
        />
        <button type="submit" className="button-primary shrink-0">Search</button>
      </form>

      {!query ? (
        <EmptyState title="Search the commercial workspace" description="Use the search field above for a provider, facility, suburb, postcode, address, Site ID, contact or opportunity." />
      ) : !normalisedQuery ? (
        <EmptyState title="Enter letters or numbers" description="Punctuation on its own is not a searchable provider, facility, contact, opportunity or customer. Try a name, ABN, Site ID, suburb or postcode." action={<Link href="/search" className="button-secondary">Clear search</Link>} />
      ) : results.length ? (
        <div className="space-y-5">
          <p className="text-sm text-[#64726c]"><span className="font-semibold text-[#244136]">{results.length}</span> results for “{query}”</p>
          {groupOrder.map((type) => {
            const items = results.filter((item) => item.object_type === type);
            if (!items.length) return null;
            const Icon = groupMeta[type].icon;
            return (
              <section key={type} className="card overflow-hidden" aria-labelledby={`search-${type}`}>
                <div className="panel-header">
                  <SectionTitle
                    id={`search-${type}`}
                    title={groupMeta[type].label}
                    description={`${items.length} matching ${items.length === 1 ? "record" : "records"}`}
                  />
                  <span className="icon-well"><Icon className="size-4" /></span>
                </div>
                <div className="divide-y divide-[#e7edea]">
                  {items.map((item) => (
                    <article key={`${type}-${item.object_id}`} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                      <Link href={withReturnTo(searchResultHref(item), origin)} className="group min-w-0 flex-1 rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6548]">
                        <h2 className="truncate text-sm font-semibold text-[#1f352c] group-hover:text-[#1f6548] group-hover:underline">{item.title}</h2>
                        <p className="mt-1 truncate text-xs text-[#64726c]">{visibleSubtitle(item, sampleProviderIds)}</p>
                        {item.location ? <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64726c]"><MapPin className="size-3.5 text-[#ff8059]" />{item.location}</p> : null}
                      </Link>
                      {type === "facility" && item.location ? (
                        <a
                          href={googleMapsSearchUrl(item.location)}
                          target="_blank"
                          rel="noreferrer"
                          className="button-secondary hidden shrink-0 sm:inline-flex"
                        >
                          Google Maps
                        </a>
                      ) : null}
                      <Link href={withReturnTo(searchResultHref(item), origin)} className="icon-button shrink-0" aria-label={`Open ${item.title}`}>
                        <ArrowRight className="size-4" />
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No matching records" description={`Nothing matched “${query}”. Try a shorter name, postcode, ABN or Site ID.`} action={<Link href="/providers" className="button-secondary">Browse providers</Link>} />
      )}
    </div>
  );
}
