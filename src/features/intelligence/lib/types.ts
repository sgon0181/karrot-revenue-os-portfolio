export type IntelligenceSource = {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  published_at: string | null;
  source_updated_at: string | null;
  retrieved_at: string;
};

export type IntelligenceClaim = {
  id: string;
  research_job_id: string;
  category: string;
  section: string;
  statement: string;
  epistemic_state: string;
  confidence: string;
  person_name: string | null;
  person_title: string | null;
  potential_relevance: string | null;
  observed_at: string | null;
  review_status: string;
  created_at: string;
  intelligence_claim_sources: Array<{
    intelligence_sources: IntelligenceSource | null;
  }>;
};

export type ResearchJob = {
  id: string;
  facility_id: string | null;
  research_scope: string;
  status: string;
  model: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  source_count: number;
  claim_count: number;
  people_count: number;
  gap_count: number;
};

export type CommercialFact = {
  id: string;
  facility_id: string | null;
  category: string;
  statement: string;
  confidence: string;
  approved_at: string;
};

export type FacilityOption = { id: string; name: string };

export type IntelligenceReturnTab = "people" | "intelligence" | "evidence";

export type ContactPromotionAction = (formData: FormData) => Promise<void>;
