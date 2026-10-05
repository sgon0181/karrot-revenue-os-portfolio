"use client";

import { useActionState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { reviewFacilityMatch, type ReviewActionState } from "@/features/data-health/server/actions";

type Candidate = {
  facility_id: string;
  site_id?: string;
  facility_name?: string;
  suburb?: string;
  provider_name?: string;
};

const initialState: ReviewActionState = { status: "idle", message: "" };

function parsedCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const row = candidate as Record<string, unknown>;
    if (typeof row.facility_id !== "string") return [];
    return [{
      facility_id: row.facility_id,
      site_id: typeof row.site_id === "string" ? row.site_id : undefined,
      facility_name: typeof row.facility_name === "string" ? row.facility_name : undefined,
      suburb: typeof row.suburb === "string" ? row.suburb : undefined,
      provider_name: typeof row.provider_name === "string" ? row.provider_name : undefined,
    }];
  });
}

function Feedback({ state }: { state: ReviewActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      aria-live="polite"
      className={`mt-2 rounded-md px-2.5 py-2 text-xs leading-4 ${state.status === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
    >
      {state.message}
    </p>
  );
}

export function MatchReviewControls({
  decisionId,
  candidates: candidateValue,
}: {
  decisionId: number;
  candidates: unknown;
}) {
  const [state, formAction, pending] = useActionState(reviewFacilityMatch, initialState);
  const candidates = parsedCandidates(candidateValue);

  return (
    <details className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5">
      <summary className="cursor-pointer text-xs font-bold text-amber-900">Resolve this observation</summary>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <form action={formAction} className="rounded-md border border-emerald-200 bg-white p-3">
          <input type="hidden" name="decision_id" value={decisionId} />
          <input type="hidden" name="action" value="confirm" />
          <p className="text-xs font-bold text-emerald-900">Confirm a facility</p>
          {candidates.length ? (
            <label className="mt-2 block text-xs font-semibold text-slate-700">
              Candidate
              <select name="facility_id" required className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800">
                <option value="">Choose a candidate</option>
                {candidates.map((candidate) => (
                  <option key={candidate.facility_id} value={candidate.facility_id}>
                    {[candidate.facility_name ?? "Unnamed facility", candidate.provider_name, candidate.site_id, candidate.suburb].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="mt-2 block text-xs font-semibold text-slate-700">
              ACQSC Site ID
              <input name="site_id" required placeholder="e.g. ARCH-00001" className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800" />
            </label>
          )}
          <label className="mt-2 block text-xs font-semibold text-slate-700">
            Review note
            <textarea name="review_note" required minLength={3} rows={2} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800" placeholder="Why this facility is the correct match" />
          </label>
          <label className="mt-2 flex items-start gap-2 text-xs leading-4 text-slate-700"><input type="checkbox" name="confirmation" value="confirmed" required className="mt-0.5 size-4" />I checked the observed source row against this facility. This creates a canonical snapshot and an attributed audit event.</label>
          <button disabled={pending} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">
            <Check className="size-3.5" aria-hidden /> Confirm and create snapshot
          </button>
        </form>

        <form action={formAction} className="rounded-md border border-rose-200 bg-white p-3">
          <input type="hidden" name="decision_id" value={decisionId} />
          <input type="hidden" name="action" value="reject" />
          <p className="text-xs font-bold text-rose-900">Reject the observation</p>
          <label className="mt-2 block text-xs font-semibold text-slate-700">
            Review note
            <textarea name="review_note" required minLength={3} rows={2} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800" placeholder="Why no facility should be assigned" />
          </label>
          <label className="mt-2 flex items-start gap-2 text-xs leading-4 text-slate-700"><input type="checkbox" name="confirmation" value="confirmed" required className="mt-0.5 size-4" />I checked the source identity and intend to leave this observation without a facility snapshot. The rejection remains in audit history.</label>
          <button disabled={pending} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-bold text-rose-800 disabled:opacity-50">
            <X className="size-3.5" aria-hidden /> Reject with audit note
          </button>
        </form>
      </div>
      <Feedback state={state} />
    </details>
  );
}

export function ReturnToReviewControl({ decisionId }: { decisionId: number }) {
  const [state, formAction, pending] = useActionState(reviewFacilityMatch, initialState);
  return (
    <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Return to review…</summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="decision_id" value={decisionId} />
        <input type="hidden" name="action" value="reset" />
        <label className="block text-xs font-semibold text-slate-700">Reassessment note<textarea name="review_note" required minLength={3} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs" placeholder="Why this rejected observation needs review again" /></label>
        <label className="flex items-start gap-2 text-xs leading-4 text-slate-700"><input type="checkbox" name="confirmation" value="confirmed" required className="mt-0.5 size-4" />I understand this reopens the decision but does not erase prior review history.</label>
        <button disabled={pending} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 disabled:opacity-50">
          <RotateCcw className="size-3" aria-hidden /> Return to review queue
        </button>
        <Feedback state={state} />
      </form>
    </details>
  );
}
