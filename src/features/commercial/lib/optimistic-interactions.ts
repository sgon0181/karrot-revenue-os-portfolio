export type InlineActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialInlineActionState: InlineActionState = {
  status: "idle",
  message: "",
};

export type OpportunityMove = {
  opportunityId: string;
  stageId: string;
};

export function moveOpportunityOptimistically<
  T extends { id: string; stage_id: string },
>(opportunities: T[], move: OpportunityMove) {
  return opportunities.map((opportunity) => (
    opportunity.id === move.opportunityId
      ? { ...opportunity, stage_id: move.stageId }
      : opportunity
  ));
}

export function completeTaskOptimistically<
  T extends { id: string; status: string },
>(task: T, actionId: string) {
  return task.id === actionId
    ? { ...task, status: "completed" }
    : task;
}
