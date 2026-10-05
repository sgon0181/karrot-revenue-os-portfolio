// Stable account-action facade. Implementations stay grouped by domain so callers do
// not need to know the internal module map.

export {
  proposeContactChange,
  reviewContactChange,
  saveContact,
} from "@/features/accounts/server/actions/contacts";
export {
  createOpportunity,
  updateOpportunity,
  updateOpportunityStage,
} from "@/features/accounts/server/actions/opportunities";
export { logActivity } from "@/features/accounts/server/actions/activities";
export {
  completeNextAction,
  createNextAction,
  rescheduleNextAction,
} from "@/features/accounts/server/actions/next-actions";
export {
  addCustomerFacility,
  updateCustomer,
} from "@/features/accounts/server/actions/customers";
