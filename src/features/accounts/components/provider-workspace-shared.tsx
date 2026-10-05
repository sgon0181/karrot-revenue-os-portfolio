import Link from "next/link";
import { ArrowRight, MapPin, Navigation } from "lucide-react";
import { SourceTrace, ratingValue } from "@/features/accounts/components/source-trace";
import { providerWorkspaceTabHref } from "@/features/accounts/lib/provider-workspace-tabs";
import type { ProviderWorkspaceCore } from "@/features/accounts/server/load-provider-workspace-core";
import { googleMapsLocationUrl } from "@/features/market/lib/maps";
import { Badge, EmptyState } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export type FacilityRecord = ProviderWorkspaceCore["facilities"][number];

export function FacilitySwitcher({
  providerId,
  facilities,
  selectedFacilityId,
  returnTo,
}: {
  providerId: string;
  facilities: FacilityRecord[];
  selectedFacilityId: string | null;
  returnTo: string | null;
}) {
  if (!facilities.length)
    return (
      <EmptyState
        title="No current facilities"
        description="This provider has no NSW home in the current government register."
      />
    );
  return (
    <div className="divide-y divide-[#e7edea] rounded-[8px] border border-[#dce6e1] bg-white">
      {facilities.map((facility) => {
        const selected = facility.id === selectedFacilityId;
        return (
          <Link
            key={facility.id}
            id={`facility-${facility.id}`}
            href={providerWorkspaceTabHref(
              providerId,
              "overview",
              facility.id,
              `#facility-${facility.id}`,
              returnTo,
            )}
            aria-current={selected ? "location" : undefined}
            className={`flex min-h-14 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#f0faf5] ${selected ? "bg-[#edf8f2]" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-[#1f352c]">
                  {facility.name}
                </p>
                {selected ? <Badge tone="green">Selected</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-[#64726c]">
                {facility.is_sample
                  ? facility.location_label ?? facility.full_address
                  : `Site ${facility.acqsc_site_id}`}
                {facility.suburb ? ` · ${facility.suburb}` : ""}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-[#64726c]" />
          </Link>
        );
      })}
    </div>
  );
}

export function GovernmentSnapshot({
  facility,
  evidence = false,
}: {
  facility: FacilityRecord;
  evidence?: boolean;
}) {
  const isSample = facility.is_sample;
  const sectionLabel = isSample ? "Facility details" : "Government data";
  const mapUrl = googleMapsLocationUrl({
    address: facility.full_address ?? "",
    latitude: facility.latitude === null ? null : Number(facility.latitude),
    longitude: facility.longitude === null ? null : Number(facility.longitude),
  });

  return (
    <section
      className="rounded-[9px] border border-[#dce6e1] bg-white"
      aria-label={`${sectionLabel} for ${facility.name}`}
    >
      <div className="flex flex-col gap-3 border-b border-[#e7edea] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-kicker">{sectionLabel}</p>
          <h2 className="mt-1 text-lg font-semibold text-[#183128]">
            {facility.name}
          </h2>
          {isSample ? (
            facility.location_label ? (
              <p className="mt-1 text-xs font-semibold text-[#2f7a58]">
                {facility.location_label}
              </p>
            ) : null
          ) : (
            <p className="mt-1 text-xs font-semibold text-[#2f7a58]">
              Site {facility.acqsc_site_id}
            </p>
          )}
        </div>
        {!isSample ? (
          <Badge
            tone={
              facility.met_responsibility === true
                ? "green"
                : facility.met_responsibility === false
                  ? "red"
                  : "slate"
            }
          >
            {facility.met_responsibility === null
              ? "Care minutes unavailable"
              : facility.met_responsibility
                ? "Responsibility met"
                : "Responsibility not met"}
          </Badge>
        ) : null}
      </div>
      <div className="p-4">
        <p className="flex items-start gap-2 text-sm leading-6 text-[#52635b]">
          <MapPin className="mt-1 size-4 shrink-0 text-[#ff8059]" />
          {facility.full_address}
        </p>
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="button-secondary mt-3"
        >
          <Navigation className="size-4" /> Open map
          <span className="sr-only"> in a new tab</span>
        </a>
        {isSample ? (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[6px] bg-[#f7faf8] p-3 text-sm sm:grid-cols-3">
            <Metric label="Location" value={facility.location_label ?? "Not recorded"} />
            <Metric label="Suburb" value={facility.suburb ?? "Not recorded"} />
            <Metric label="Postcode" value={facility.postcode ?? "Not recorded"} />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[6px] bg-[#f7faf8] p-3 text-sm sm:grid-cols-3">
            <Metric label="Overall rating" value={ratingValue(facility.overall_rating)} />
            <Metric label="Staffing rating" value={ratingValue(facility.staffing_rating)} />
            <Metric
              label="Care minutes"
              value={
                facility.total_target_percentage == null
                  ? "Not available"
                  : `${Number(facility.total_target_percentage).toFixed(1)}%`
              }
            />
            <Metric
              label="Approved beds"
              value={facility.approved_bed_size_band ?? "Not available"}
            />
            <Metric label="Ratings period" value={formatDate(facility.star_reporting_month)} />
            <Metric label="Care period" value={formatDate(facility.care_minutes_period_end)} />
          </div>
        )}
        {evidence && !isSample ? (
          <div className="mt-4 space-y-2 border-t border-[#e7edea] pt-4">
            <SourceTrace
              label="Star Ratings source"
              fileName={facility.star_source_file_name}
              sheetName={facility.star_source_sheet_name}
              rowNumber={facility.star_source_row_number}
              checksum={facility.star_source_sha256}
              sourceUrl={facility.star_source_url}
            />
            <SourceTrace
              label="Care Minutes source"
              fileName={facility.care_source_file_name}
              sheetName={facility.care_source_sheet_name}
              rowNumber={facility.care_source_row_number}
              checksum={facility.care_source_sha256}
              sourceUrl={facility.care_source_url}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
