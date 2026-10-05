import { History } from "lucide-react";
import { BriefSections } from "@/features/intelligence/components/brief-sections";
import type { ResearchFreshnessPolicy } from "@/features/intelligence/lib/freshness";
import type {
  ContactPromotionAction,
  IntelligenceClaim,
  IntelligenceReturnTab,
  ResearchJob,
} from "@/features/intelligence/lib/types";
import { Badge } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/format";

export function ResearchHistory({
  jobs,
  currentJobId,
  claims,
  providerId,
  facilityId,
  canEdit,
  contactAction,
  freshnessPolicy,
  returnFacilityId,
  returnTab = "intelligence",
}: {
  jobs: ResearchJob[];
  currentJobId: string | null;
  claims: IntelligenceClaim[];
  providerId: string;
  facilityId: string | null;
  canEdit: boolean;
  contactAction: ContactPromotionAction;
  freshnessPolicy: ResearchFreshnessPolicy;
  returnFacilityId?: string | null;
  returnTab?: IntelligenceReturnTab;
}) {
  if (!jobs.length) return null;
  return (
    <details className="mt-4 rounded-[7px] border border-[#dce7e1] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-[#385348]">
        <History className="size-4" />
        Research history ({jobs.length})
      </summary>
      <div className="divide-y divide-[#e7edea] border-t border-[#e7edea]">
        {jobs.map((job) => {
          const savedClaims = claims.filter(
            (claim) => claim.research_job_id === job.id,
          );
          return (
            <div key={job.id} className="px-4 py-3 text-xs text-[#64726c]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#344a40]">
                    {job.id === currentJobId
                      ? "Current intelligence"
                      : job.model === "operator-curated"
                        ? "Operator evidence"
                        : "Previous research run"}
                  </p>
                  <p>
                    {formatDate(
                      job.completed_at ?? job.started_at ?? job.requested_at,
                      true,
                    )}{" "}
                    · {job.model}
                  </p>
                  {job.error_message ? (
                    <p className="mt-1 text-rose-700">{job.error_message}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      job.status === "completed"
                        ? "green"
                        : job.status === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {job.status}
                  </Badge>
                  <span>
                    {job.source_count} sources · {job.claim_count} findings
                  </span>
                </div>
              </div>
              {savedClaims.length && job.id !== currentJobId ? (
                <details className="mt-3 rounded-[6px] border border-[#e3ebe7] bg-[#f8fbf9] p-3">
                  <summary className="cursor-pointer font-semibold text-[#1f6548]">
                    Inspect this saved run
                  </summary>
                  <div className="mt-4">
                    <BriefSections
                      claims={savedClaims}
                      providerId={providerId}
                      facilityId={facilityId}
                      canEdit={canEdit}
                      contactAction={contactAction}
                      freshnessPolicy={freshnessPolicy}
                      returnFacilityId={returnFacilityId}
                      returnTab={returnTab}
                    />
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}
