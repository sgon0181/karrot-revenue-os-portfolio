import { ExternalLink } from "lucide-react";

export function ratingValue(value: number | null) {
  return value ? `${value} / 5` : "Not available";
}

export function SourceTrace({
  label,
  fileName,
  sheetName,
  rowNumber,
  checksum,
  sourceUrl,
}: {
  label: string;
  fileName: string | null;
  sheetName: string | null;
  rowNumber: number | null;
  checksum: string | null;
  sourceUrl: string | null;
}) {
  if (!fileName) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-[#64726c] sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <p className="min-w-0">
        <span className="font-semibold text-[#385348]">{label}:</span>{" "}
        <span title={checksum ?? undefined}>{fileName}</span>
        {sheetName ? ` · ${sheetName}` : ""}
        {rowNumber == null ? "" : ` · row ${rowNumber}`}
      </p>
      {sourceUrl ? (
        <a className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#1f6548] hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">
          Publication <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
}
