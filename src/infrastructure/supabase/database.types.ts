export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_research_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_code: string | null
          error_message: string | null
          facility_id: string | null
          id: string
          model: string
          provider_id: string
          provider_snapshot: Json
          request_context: Json
          requested_at: string
          research_scope: string
          response_id: string | null
          started_at: string | null
          status: string
          token_usage: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_code?: string | null
          error_message?: string | null
          facility_id?: string | null
          id?: string
          model: string
          provider_id: string
          provider_snapshot?: Json
          request_context?: Json
          requested_at?: string
          research_scope?: string
          response_id?: string | null
          started_at?: string | null
          status?: string
          token_usage?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_code?: string | null
          error_message?: string | null
          facility_id?: string | null
          id?: string
          model?: string
          provider_id?: string
          provider_snapshot?: Json
          request_context?: Json
          requested_at?: string
          research_scope?: string
          response_id?: string | null
          started_at?: string | null
          status?: string
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "account_research_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_research_jobs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_research_jobs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_research_jobs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_research_jobs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_type: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          facility_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          opportunity_id: string | null
          provider_id: string
          record_mode: string
          subject: string
        }
        Insert: {
          activity_type: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          provider_id: string
          record_mode?: string
          subject: string
        }
        Update: {
          activity_type?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          provider_id?: string
          record_mode?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      care_minutes_snapshots: {
        Row: {
          address: string | null
          created_at: string
          en_minutes_actual: number | null
          facility_id: string
          home_size_band: string | null
          id: number
          latitude: number | null
          longitude: number | null
          met_responsibility: boolean | null
          mmm_location: number | null
          observed_home_name: string
          observed_provider_name: string
          period_end: string
          period_start: string
          rn_minutes_actual: number | null
          rn_minutes_target: number | null
          rn_performance: number | null
          rn_target_percentage: number | null
          source_file_id: string
          source_record_id: number
          state: string
          suburb: string | null
          total_minutes_actual: number | null
          total_minutes_target: number | null
          total_target_percentage: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          en_minutes_actual?: number | null
          facility_id: string
          home_size_band?: string | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          met_responsibility?: boolean | null
          mmm_location?: number | null
          observed_home_name: string
          observed_provider_name: string
          period_end: string
          period_start: string
          rn_minutes_actual?: number | null
          rn_minutes_target?: number | null
          rn_performance?: number | null
          rn_target_percentage?: number | null
          source_file_id: string
          source_record_id: number
          state: string
          suburb?: string | null
          total_minutes_actual?: number | null
          total_minutes_target?: number | null
          total_target_percentage?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          en_minutes_actual?: number | null
          facility_id?: string
          home_size_band?: string | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          met_responsibility?: boolean | null
          mmm_location?: number | null
          observed_home_name?: string
          observed_provider_name?: string
          period_end?: string
          period_start?: string
          rn_minutes_actual?: number | null
          rn_minutes_target?: number | null
          rn_performance?: number | null
          rn_target_percentage?: number | null
          source_file_id?: string
          source_record_id?: number
          state?: string
          suburb?: string | null
          total_minutes_actual?: number | null
          total_minutes_target?: number | null
          total_target_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "care_minutes_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_minutes_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_minutes_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_minutes_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "care_minutes_snapshots_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_account_facts: {
        Row: {
          approved_at: string
          approved_by: string
          category: string
          confidence: string
          created_at: string
          epistemic_state: string
          facility_id: string | null
          id: string
          is_active: boolean
          provider_id: string
          source_claim_id: string
          statement: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          category: string
          confidence: string
          created_at?: string
          epistemic_state: string
          facility_id?: string | null
          id?: string
          is_active?: boolean
          provider_id: string
          source_claim_id: string
          statement: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          category?: string
          confidence?: string
          created_at?: string
          epistemic_state?: string
          facility_id?: string | null
          id?: string
          is_active?: boolean
          provider_id?: string
          source_claim_id?: string
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_account_facts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_account_facts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_account_facts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_account_facts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_account_facts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_account_facts_source_claim_id_fkey"
            columns: ["source_claim_id"]
            isOneToOne: true
            referencedRelation: "intelligence_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_change_proposals: {
        Row: {
          contact_id: string
          id: string
          intelligence_source_id: string | null
          observed_at: string | null
          previous_values: Json
          proposal_kind: string
          proposal_note: string | null
          proposed_at: string
          proposed_by: string
          proposed_changes: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string | null
          source_url: string | null
          status: string
        }
        Insert: {
          contact_id: string
          id?: string
          intelligence_source_id?: string | null
          observed_at?: string | null
          previous_values: Json
          proposal_kind: string
          proposal_note?: string | null
          proposed_at?: string
          proposed_by: string
          proposed_changes?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
        }
        Update: {
          contact_id?: string
          id?: string
          intelligence_source_id?: string | null
          observed_at?: string | null
          previous_values?: Json
          proposal_kind?: string
          proposal_note?: string | null
          proposed_at?: string
          proposed_by?: string
          proposed_changes?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_change_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_change_proposals_intelligence_source_id_fkey"
            columns: ["intelligence_source_id"]
            isOneToOne: false
            referencedRelation: "intelligence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_change_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_change_proposals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_verification_events: {
        Row: {
          contact_id: string
          event_type: string
          id: number
          intelligence_source_id: string | null
          note: string | null
          occurred_at: string
          performed_by: string
          previous_values: Json
          proposal_id: string
          proposed_values: Json
          resulting_values: Json | null
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          contact_id: string
          event_type: string
          id?: never
          intelligence_source_id?: string | null
          note?: string | null
          occurred_at?: string
          performed_by: string
          previous_values: Json
          proposal_id: string
          proposed_values: Json
          resulting_values?: Json | null
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          contact_id?: string
          event_type?: string
          id?: never
          intelligence_source_id?: string | null
          note?: string | null
          occurred_at?: string
          performed_by?: string
          previous_values?: Json
          proposal_id?: string
          proposed_values?: Json
          resulting_values?: Json | null
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_verification_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_verification_events_intelligence_source_id_fkey"
            columns: ["intelligence_source_id"]
            isOneToOne: false
            referencedRelation: "intelligence_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_verification_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_verification_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "contact_change_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          currentness_status: string
          email: string | null
          facility_id: string | null
          full_name: string
          id: string
          last_observed_at: string | null
          last_verified_at: string | null
          notes: string | null
          phone: string | null
          professional_profile_url: string | null
          provider_id: string
          record_mode: string
          relationship_status: string | null
          role_category: string | null
          source_type: string | null
          source_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currentness_status?: string
          email?: string | null
          facility_id?: string | null
          full_name: string
          id?: string
          last_observed_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          phone?: string | null
          professional_profile_url?: string | null
          provider_id: string
          record_mode?: string
          relationship_status?: string | null
          role_category?: string | null
          source_type?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currentness_status?: string
          email?: string | null
          facility_id?: string | null
          full_name?: string
          id?: string
          last_observed_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          phone?: string | null
          professional_profile_url?: string | null
          provider_id?: string
          record_mode?: string
          relationship_status?: string | null
          role_category?: string | null
          source_type?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_facilities: {
        Row: {
          contract_start_date: string | null
          contracted_beds: number | null
          created_at: string
          customer_relationship_id: string
          ended_at: string | null
          facility_id: string
          go_live_date: string | null
          id: string
          live_beds: number | null
          notes: string | null
          onboarding_state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contract_start_date?: string | null
          contracted_beds?: number | null
          created_at?: string
          customer_relationship_id: string
          ended_at?: string | null
          facility_id: string
          go_live_date?: string | null
          id?: string
          live_beds?: number | null
          notes?: string | null
          onboarding_state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contract_start_date?: string | null
          contracted_beds?: number | null
          created_at?: string
          customer_relationship_id?: string
          ended_at?: string | null
          facility_id?: string
          go_live_date?: string | null
          id?: string
          live_beds?: number | null
          notes?: string | null
          onboarding_state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_facilities_customer_relationship_id_fkey"
            columns: ["customer_relationship_id"]
            isOneToOne: false
            referencedRelation: "customer_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_facilities_customer_relationship_id_fkey"
            columns: ["customer_relationship_id"]
            isOneToOne: false
            referencedRelation: "v_customer_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_relationships: {
        Row: {
          arr: number | null
          contract_end_date: string | null
          contract_start_date: string | null
          contracted_beds: number | null
          created_at: string
          customer_since: string | null
          id: string
          mrr: number | null
          notes: string | null
          onboarding_state: string | null
          originating_opportunity_id: string | null
          owner_id: string | null
          provider_id: string
          record_mode: string
          renewal_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arr?: number | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contracted_beds?: number | null
          created_at?: string
          customer_since?: string | null
          id?: string
          mrr?: number | null
          notes?: string | null
          onboarding_state?: string | null
          originating_opportunity_id?: string | null
          owner_id?: string | null
          provider_id: string
          record_mode?: string
          renewal_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arr?: number | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contracted_beds?: number | null
          created_at?: string
          customer_since?: string | null
          id?: string
          mrr?: number | null
          notes?: string | null
          onboarding_state?: string | null
          originating_opportunity_id?: string | null
          owner_id?: string | null
          provider_id?: string
          record_mode?: string
          renewal_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_relationships_originating_opportunity_id_fkey"
            columns: ["originating_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_originating_opportunity_id_fkey"
            columns: ["originating_opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_issues: {
        Row: {
          details: Json
          entity_id: string | null
          entity_type: string | null
          first_seen_at: string
          first_seen_run_id: string | null
          id: number
          issue_code: string
          last_seen_at: string
          last_seen_run_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          source_file_id: string
          source_record_id: number | null
          status: string
          summary: string
        }
        Insert: {
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          first_seen_at?: string
          first_seen_run_id?: string | null
          id?: never
          issue_code: string
          last_seen_at?: string
          last_seen_run_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          severity: string
          source_file_id: string
          source_record_id?: number | null
          status?: string
          summary: string
        }
        Update: {
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          first_seen_at?: string
          first_seen_run_id?: string | null
          id?: never
          issue_code?: string
          last_seen_at?: string
          last_seen_run_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          source_file_id?: string
          source_record_id?: number | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_issues_first_seen_run_id_fkey"
            columns: ["first_seen_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_first_seen_run_id_fkey"
            columns: ["first_seen_run_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["latest_run_id"]
          },
          {
            foreignKeyName: "data_quality_issues_last_seen_run_id_fkey"
            columns: ["last_seen_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_last_seen_run_id_fkey"
            columns: ["last_seen_run_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["latest_run_id"]
          },
          {
            foreignKeyName: "data_quality_issues_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "data_quality_issues_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          acqsc_site_id: string
          archived_at: string | null
          created_at: string
          current_authoritative_source_record_id: number | null
          first_seen_at: string
          full_address: string
          id: string
          is_sample: boolean
          last_seen_at: string
          latitude: number | null
          location_label: string | null
          longitude: number | null
          name: string
          normalized_address: string
          normalized_name: string
          normalized_suburb: string
          postcode: string
          provider_id: string
          state: string
          street: string
          suburb: string
          updated_at: string
        }
        Insert: {
          acqsc_site_id: string
          archived_at?: string | null
          created_at?: string
          current_authoritative_source_record_id?: number | null
          first_seen_at: string
          full_address: string
          id?: string
          is_sample?: boolean
          last_seen_at: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name: string
          normalized_address: string
          normalized_name: string
          normalized_suburb: string
          postcode: string
          provider_id: string
          state: string
          street: string
          suburb: string
          updated_at?: string
        }
        Update: {
          acqsc_site_id?: string
          archived_at?: string | null
          created_at?: string
          current_authoritative_source_record_id?: number | null
          first_seen_at?: string
          full_address?: string
          id?: string
          is_sample?: boolean
          last_seen_at?: string
          latitude?: number | null
          location_label?: string | null
          longitude?: number | null
          name?: string
          normalized_address?: string
          normalized_name?: string
          normalized_suburb?: string
          postcode?: string
          provider_id?: string
          state?: string
          street?: string
          suburb?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_current_authoritative_source_record_id_fkey"
            columns: ["current_authoritative_source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_aliases: {
        Row: {
          alias: string
          created_at: string
          facility_id: string
          id: number
          normalized_alias: string
          normalized_provider_alias: string | null
          normalized_suburb: string | null
          provider_alias: string | null
          source_file_id: string
          source_record_id: number | null
          suburb: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          facility_id: string
          id?: never
          normalized_alias: string
          normalized_provider_alias?: string | null
          normalized_suburb?: string | null
          provider_alias?: string | null
          source_file_id: string
          source_record_id?: number | null
          suburb?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          facility_id?: string
          id?: never
          normalized_alias?: string
          normalized_provider_alias?: string | null
          normalized_suburb?: string | null
          provider_alias?: string | null
          source_file_id?: string
          source_record_id?: number | null
          suburb?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_aliases_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_aliases_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_aliases_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_aliases_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "facility_aliases_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_match_candidates: {
        Row: {
          candidate_rank: number
          created_at: string
          decision_id: number
          facility_id: string
          id: number
          match_rule: string
          signals: Json
        }
        Insert: {
          candidate_rank: number
          created_at?: string
          decision_id: number
          facility_id: string
          id?: never
          match_rule: string
          signals?: Json
        }
        Update: {
          candidate_rank?: number
          created_at?: string
          decision_id?: number
          facility_id?: string
          id?: never
          match_rule?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "facility_match_candidates_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "facility_match_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_candidates_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "v_match_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_candidates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_candidates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_match_decisions: {
        Row: {
          created_at: string
          dataset_code: string
          evidence: Json
          facility_id: string | null
          id: number
          match_method: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_file_id: string
          source_record_id: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_code: string
          evidence?: Json
          facility_id?: string | null
          id?: never
          match_method: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file_id: string
          source_record_id: number
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_code?: string
          evidence?: Json
          facility_id?: string | null
          id?: never
          match_method?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_file_id?: string
          source_record_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_match_decisions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_decisions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_decisions_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_decisions_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "facility_match_decisions_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_match_review_events: {
        Row: {
          action: string
          decision_id: number
          facility_id: string | null
          from_status: string
          id: number
          review_note: string
          reviewed_at: string
          reviewed_by: string
          to_status: string
        }
        Insert: {
          action: string
          decision_id: number
          facility_id?: string | null
          from_status: string
          id?: never
          review_note: string
          reviewed_at?: string
          reviewed_by: string
          to_status: string
        }
        Update: {
          action?: string
          decision_id?: number
          facility_id?: string | null
          from_status?: string
          id?: never
          review_note?: string
          reviewed_at?: string
          reviewed_by?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_match_review_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "facility_match_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "v_match_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_snapshots: {
        Row: {
          acqsc_site_id: string
          created_at: string
          facility_id: string
          full_address: string
          id: number
          name: string
          observed_at: string
          postcode: string
          provider_id: string
          source_file_id: string
          source_record_id: number
          state: string
          street: string
          suburb: string
        }
        Insert: {
          acqsc_site_id: string
          created_at?: string
          facility_id: string
          full_address: string
          id?: never
          name: string
          observed_at: string
          postcode: string
          provider_id: string
          source_file_id: string
          source_record_id: number
          state: string
          street: string
          suburb: string
        }
        Update: {
          acqsc_site_id?: string
          created_at?: string
          facility_id?: string
          full_address?: string
          id?: never
          name?: string
          observed_at?: string
          postcode?: string
          provider_id?: string
          source_file_id?: string
          source_record_id?: number
          state?: string
          street?: string
          suburb?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_snapshots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_snapshots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "facility_snapshots_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      field_visits: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          facility_id: string
          id: string
          notes: string | null
          record_mode: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          facility_id: string
          id?: string
          notes?: string | null
          record_mode?: string
          starts_at: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          facility_id?: string
          id?: string
          notes?: string | null
          record_mode?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          details: Json
          duplicate_candidates: number
          error_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          importer_version: string
          matched_records: number
          records_created: number
          records_updated: number
          rows_processed: number
          source_file_id: string
          started_at: string
          status: string
          unmatched_records: number
          unresolved_records: number
        }
        Insert: {
          details?: Json
          duplicate_candidates?: number
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          importer_version: string
          matched_records?: number
          records_created?: number
          records_updated?: number
          rows_processed?: number
          source_file_id: string
          started_at?: string
          status?: string
          unmatched_records?: number
          unresolved_records?: number
        }
        Update: {
          details?: Json
          duplicate_candidates?: number
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          importer_version?: string
          matched_records?: number
          records_created?: number
          records_updated?: number
          rows_processed?: number
          source_file_id?: string
          started_at?: string
          status?: string
          unmatched_records?: number
          unresolved_records?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
        ]
      }
      intelligence_claim_sources: {
        Row: {
          claim_id: string
          source_id: string
        }
        Insert: {
          claim_id: string
          source_id: string
        }
        Update: {
          claim_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_claim_sources_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "intelligence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_claim_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intelligence_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_claims: {
        Row: {
          category: string
          confidence: string
          created_at: string
          created_by: string
          epistemic_state: string
          id: string
          observed_at: string | null
          person_name: string | null
          person_title: string | null
          potential_relevance: string | null
          provider_id: string
          research_job_id: string | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          section: string
          statement: string
        }
        Insert: {
          category: string
          confidence: string
          created_at?: string
          created_by?: string
          epistemic_state: string
          id?: string
          observed_at?: string | null
          person_name?: string | null
          person_title?: string | null
          potential_relevance?: string | null
          provider_id: string
          research_job_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          section: string
          statement: string
        }
        Update: {
          category?: string
          confidence?: string
          created_at?: string
          created_by?: string
          epistemic_state?: string
          id?: string
          observed_at?: string | null
          person_name?: string | null
          person_title?: string | null
          potential_relevance?: string | null
          provider_id?: string
          research_job_id?: string | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          section?: string
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_claims_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_claims_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_claims_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "account_research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_review_events: {
        Row: {
          action: string
          claim_id: string
          id: number
          note: string | null
          previous_status: string
          provider_id: string
          resulting_statement: string | null
          reviewed_at: string
          reviewed_by: string
        }
        Insert: {
          action: string
          claim_id: string
          id?: never
          note?: string | null
          previous_status: string
          provider_id: string
          resulting_statement?: string | null
          reviewed_at?: string
          reviewed_by: string
        }
        Update: {
          action?: string
          claim_id?: string
          id?: never
          note?: string | null
          previous_status?: string
          provider_id?: string
          resulting_statement?: string | null
          reviewed_at?: string
          reviewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_review_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "intelligence_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_review_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_review_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_review_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_sources: {
        Row: {
          content_hash: string | null
          created_at: string
          created_by: string
          excerpt: string | null
          id: string
          provider_id: string
          published_at: string | null
          publisher: string | null
          research_job_id: string | null
          retrieved_at: string
          source_type: string
          source_updated_at: string | null
          title: string
          url: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          provider_id: string
          published_at?: string | null
          publisher?: string | null
          research_job_id?: string | null
          retrieved_at?: string
          source_type?: string
          source_updated_at?: string | null
          title: string
          url: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          provider_id?: string
          published_at?: string | null
          publisher?: string | null
          research_job_id?: string | null
          retrieved_at?: string
          source_type?: string
          source_updated_at?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_sources_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_sources_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_sources_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "account_research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      next_actions: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          notes: string | null
          opportunity_id: string | null
          priority: string
          provider_id: string
          record_mode: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          priority?: string
          provider_id: string
          record_mode?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          priority?: string
          provider_id?: string
          record_mode?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          blockers: string | null
          champion_notes: string | null
          closed_lost_at: string | null
          closed_lost_reason: string | null
          closed_won_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          decision_process: string | null
          estimated_beds: number | null
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          primary_contact_id: string | null
          problem_statement: string | null
          provider_id: string
          record_mode: string
          stage_entered_at: string
          stage_id: string
          updated_at: string
          why_now: string | null
        }
        Insert: {
          blockers?: string | null
          champion_notes?: string | null
          closed_lost_at?: string | null
          closed_lost_reason?: string | null
          closed_won_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_process?: string | null
          estimated_beds?: number | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          problem_statement?: string | null
          provider_id: string
          record_mode?: string
          stage_entered_at?: string
          stage_id: string
          updated_at?: string
          why_now?: string | null
        }
        Update: {
          blockers?: string | null
          champion_notes?: string | null
          closed_lost_at?: string | null
          closed_lost_reason?: string | null
          closed_won_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_process?: string | null
          estimated_beds?: number | null
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          primary_contact_id?: string | null
          problem_statement?: string | null
          provider_id?: string
          record_mode?: string
          stage_entered_at?: string
          stage_id?: string
          updated_at?: string
          why_now?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "v_opportunities_by_stage"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          entered_at: string
          exited_at: string | null
          from_stage_id: string | null
          id: number
          opportunity_id: string
          to_stage_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          entered_at: string
          exited_at?: string | null
          from_stage_id?: string | null
          id?: never
          opportunity_id: string
          to_stage_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          entered_at?: string
          exited_at?: string | null
          from_stage_id?: string | null
          id?: never
          opportunity_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "v_opportunities_by_stage"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "v_opportunities_by_stage"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          outcome: string | null
          position: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          outcome?: string | null
          position: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          outcome?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_aliases: {
        Row: {
          alias: string
          alias_type: string
          created_at: string
          id: number
          normalized_alias: string
          provider_id: string
          source_file_id: string
          source_record_id: number | null
        }
        Insert: {
          alias: string
          alias_type: string
          created_at?: string
          id?: never
          normalized_alias: string
          provider_id: string
          source_file_id: string
          source_record_id?: number | null
        }
        Update: {
          alias?: string
          alias_type?: string
          created_at?: string
          id?: never
          normalized_alias?: string
          provider_id?: string
          source_file_id?: string
          source_record_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_aliases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_aliases_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_aliases_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_aliases_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "provider_aliases_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_lgas: {
        Row: {
          id: number
          lga: string
          provider_id: string
          registration_category: string
          source_file_id: string
          source_record_id: number
        }
        Insert: {
          id?: never
          lga: string
          provider_id: string
          registration_category: string
          source_file_id: string
          source_record_id: number
        }
        Update: {
          id?: never
          lga?: string
          provider_id?: string
          registration_category?: string
          source_file_id?: string
          source_record_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_lgas_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_lgas_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_lgas_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_lgas_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "provider_lgas_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_regulatory_notices: {
        Row: {
          created_at: string
          detail: string | null
          detail_url: string | null
          ends_on: string | null
          id: number
          issued_by: string | null
          notice_type: string | null
          provider_id: string
          required_action: string | null
          source_file_id: string
          source_record_id: number
          starts_on: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          detail_url?: string | null
          ends_on?: string | null
          id?: never
          issued_by?: string | null
          notice_type?: string | null
          provider_id: string
          required_action?: string | null
          source_file_id: string
          source_record_id: number
          starts_on?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          detail_url?: string | null
          ends_on?: string | null
          id?: never
          issued_by?: string | null
          notice_type?: string | null
          provider_id?: string
          required_action?: string | null
          source_file_id?: string
          source_record_id?: number
          starts_on?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_regulatory_notices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_regulatory_notices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_regulatory_notices_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_regulatory_notices_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "provider_regulatory_notices_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_types: {
        Row: {
          id: number
          provider_id: string
          registration_category: string
          service_type: string
          source_file_id: string
          source_record_id: number
        }
        Insert: {
          id?: never
          provider_id: string
          registration_category: string
          service_type: string
          source_file_id: string
          source_record_id: number
        }
        Update: {
          id?: never
          provider_id?: string
          registration_category?: string
          service_type?: string
          source_file_id?: string
          source_record_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_types_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_types_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_types_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_types_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "provider_service_types_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_snapshots: {
        Row: {
          banning_order: Json
          business_name: string
          created_at: string
          entity_name: string
          full_address: string | null
          id: number
          intends_special_program_delivery: boolean | null
          observed_at: string
          postcode: string | null
          provider_id: string
          registration_end_date: string | null
          registration_lapse_date: string | null
          registration_start_date: string | null
          registration_status: string | null
          revocation: Json
          source_file_id: string
          source_record_id: number
          specialist_aged_care_programs: string | null
          state: string | null
          street: string | null
          suburb: string | null
          suspension: Json
        }
        Insert: {
          banning_order?: Json
          business_name: string
          created_at?: string
          entity_name: string
          full_address?: string | null
          id?: never
          intends_special_program_delivery?: boolean | null
          observed_at: string
          postcode?: string | null
          provider_id: string
          registration_end_date?: string | null
          registration_lapse_date?: string | null
          registration_start_date?: string | null
          registration_status?: string | null
          revocation?: Json
          source_file_id: string
          source_record_id: number
          specialist_aged_care_programs?: string | null
          state?: string | null
          street?: string | null
          suburb?: string | null
          suspension?: Json
        }
        Update: {
          banning_order?: Json
          business_name?: string
          created_at?: string
          entity_name?: string
          full_address?: string | null
          id?: never
          intends_special_program_delivery?: boolean | null
          observed_at?: string
          postcode?: string | null
          provider_id?: string
          registration_end_date?: string | null
          registration_lapse_date?: string | null
          registration_start_date?: string | null
          registration_status?: string | null
          revocation?: Json
          source_file_id?: string
          source_record_id?: number
          specialist_aged_care_programs?: string | null
          state?: string | null
          street?: string | null
          suburb?: string | null
          suspension?: Json
        }
        Relationships: [
          {
            foreignKeyName: "provider_snapshots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_snapshots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "provider_snapshots_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_workspace_views: {
        Row: {
          first_opened_at: string
          last_opened_at: string
          open_count: number
          provider_id: string
          user_id: string
        }
        Insert: {
          first_opened_at?: string
          last_opened_at?: string
          open_count?: number
          provider_id: string
          user_id: string
        }
        Update: {
          first_opened_at?: string
          last_opened_at?: string
          open_count?: number
          provider_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_workspace_views_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workspace_views_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workspace_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          abn: string
          archived_at: string | null
          business_name: string
          created_at: string
          current_authoritative_source_record_id: number | null
          entity_name: string
          first_seen_at: string
          id: string
          is_sample: boolean
          last_seen_at: string
          normalized_business_name: string
          normalized_entity_name: string
          registration_status: string | null
          updated_at: string
        }
        Insert: {
          abn: string
          archived_at?: string | null
          business_name: string
          created_at?: string
          current_authoritative_source_record_id?: number | null
          entity_name: string
          first_seen_at: string
          id?: string
          is_sample?: boolean
          last_seen_at: string
          normalized_business_name: string
          normalized_entity_name: string
          registration_status?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string
          archived_at?: string | null
          business_name?: string
          created_at?: string
          current_authoritative_source_record_id?: number | null
          entity_name?: string
          first_seen_at?: string
          id?: string
          is_sample?: boolean
          last_seen_at?: string
          normalized_business_name?: string
          normalized_entity_name?: string
          registration_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_current_authoritative_source_record_id_fkey"
            columns: ["current_authoritative_source_record_id"]
            isOneToOne: false
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
      source_files: {
        Row: {
          acquired_at: string
          compiled_at: string | null
          created_at: string
          dataset_code: string
          file_name: string
          id: string
          metadata: Json
          publisher: string
          reporting_end_date: string | null
          reporting_start_date: string | null
          schema_version: string
          sha256: string
          source_as_of_date: string | null
          source_url: string | null
          title: string
        }
        Insert: {
          acquired_at?: string
          compiled_at?: string | null
          created_at?: string
          dataset_code: string
          file_name: string
          id?: string
          metadata?: Json
          publisher: string
          reporting_end_date?: string | null
          reporting_start_date?: string | null
          schema_version: string
          sha256: string
          source_as_of_date?: string | null
          source_url?: string | null
          title: string
        }
        Update: {
          acquired_at?: string
          compiled_at?: string | null
          created_at?: string
          dataset_code?: string
          file_name?: string
          id?: string
          metadata?: Json
          publisher?: string
          reporting_end_date?: string | null
          reporting_start_date?: string | null
          schema_version?: string
          sha256?: string
          source_as_of_date?: string | null
          source_url?: string | null
          title?: string
        }
        Relationships: []
      }
      source_records: {
        Row: {
          id: number
          imported_at: string
          raw_data: Json
          row_hash: string
          row_number: number
          sheet_name: string
          source_file_id: string
        }
        Insert: {
          id?: never
          imported_at?: string
          raw_data: Json
          row_hash: string
          row_number: number
          sheet_name: string
          source_file_id: string
        }
        Update: {
          id?: never
          imported_at?: string
          raw_data?: Json
          row_hash?: string
          row_number?: number
          sheet_name?: string
          source_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_records_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_records_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
        ]
      }
      star_rating_snapshots: {
        Row: {
          aged_care_planning_region: string | null
          compliance_detail: Json
          compliance_rating: number | null
          created_at: string
          facility_id: string
          id: number
          interview_year: number | null
          mmm_code: string | null
          mmm_region: string | null
          observed_provider_name: string
          overall_rating: number | null
          purpose: string | null
          quality_measures_detail: Json
          quality_measures_rating: number | null
          reporting_month: string
          reporting_period: string
          residents_experience_detail: Json
          residents_experience_rating: number | null
          rn_minutes_actual: number | null
          rn_minutes_target: number | null
          size_band: string | null
          source_file_id: string
          source_record_id: number
          staffing_rating: number | null
          state: string
          total_minutes_actual: number | null
          total_minutes_target: number | null
        }
        Insert: {
          aged_care_planning_region?: string | null
          compliance_detail?: Json
          compliance_rating?: number | null
          created_at?: string
          facility_id: string
          id?: never
          interview_year?: number | null
          mmm_code?: string | null
          mmm_region?: string | null
          observed_provider_name: string
          overall_rating?: number | null
          purpose?: string | null
          quality_measures_detail?: Json
          quality_measures_rating?: number | null
          reporting_month: string
          reporting_period: string
          residents_experience_detail?: Json
          residents_experience_rating?: number | null
          rn_minutes_actual?: number | null
          rn_minutes_target?: number | null
          size_band?: string | null
          source_file_id: string
          source_record_id: number
          staffing_rating?: number | null
          state: string
          total_minutes_actual?: number | null
          total_minutes_target?: number | null
        }
        Update: {
          aged_care_planning_region?: string | null
          compliance_detail?: Json
          compliance_rating?: number | null
          created_at?: string
          facility_id?: string
          id?: never
          interview_year?: number | null
          mmm_code?: string | null
          mmm_region?: string | null
          observed_provider_name?: string
          overall_rating?: number | null
          purpose?: string | null
          quality_measures_detail?: Json
          quality_measures_rating?: number | null
          reporting_month?: string
          reporting_period?: string
          residents_experience_detail?: Json
          residents_experience_rating?: number | null
          rn_minutes_actual?: number | null
          rn_minutes_target?: number | null
          size_band?: string | null
          source_file_id?: string
          source_record_id?: number
          staffing_rating?: number | null
          state?: string
          total_minutes_actual?: number | null
          total_minutes_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "star_rating_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "star_rating_snapshots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "star_rating_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "star_rating_snapshots_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
          {
            foreignKeyName: "star_rating_snapshots_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: true
            referencedRelation: "source_records"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_customer_overview: {
        Row: {
          abn: string | null
          arr: number | null
          beds_live: number | null
          contract_end_date: string | null
          contract_start_date: string | null
          contracted_beds: number | null
          customer_since: string | null
          facilities_contracted: number | null
          facilities_live: number | null
          id: string | null
          mrr: number | null
          onboarding_state: string | null
          originating_opportunity_id: string | null
          provider_id: string | null
          provider_name: string | null
          record_mode: string | null
          renewal_date: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_relationships_originating_opportunity_id_fkey"
            columns: ["originating_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_originating_opportunity_id_fkey"
            columns: ["originating_opportunity_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationships_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dashboard_metrics: {
        Row: {
          actions_due: number | null
          active_customers: number | null
          active_opportunities: number | null
          arr: number | null
          beds_live: number | null
          contacts: number | null
          facilities_live: number | null
          mrr: number | null
          nsw_facilities: number | null
          nsw_providers: number | null
          overdue_actions: number | null
          sandbox_customers: number | null
          sandbox_open_actions: number | null
          sandbox_opportunities: number | null
        }
        Relationships: []
      }
      v_data_import_health: {
        Row: {
          dataset_code: string | null
          duplicate_candidates: number | null
          error_count: number | null
          file_name: string | null
          latest_import_finished_at: string | null
          latest_import_started_at: string | null
          latest_import_status: string | null
          latest_run_id: string | null
          matched_records: number | null
          open_errors: number | null
          open_issues: number | null
          publisher: string | null
          records_created: number | null
          records_updated: number | null
          reporting_end_date: string | null
          reporting_start_date: string | null
          rows_processed: number | null
          sha256: string | null
          source_as_of_date: string | null
          source_file_id: string | null
          source_url: string | null
          title: string | null
          unmatched_records: number | null
          unresolved_records: number | null
        }
        Relationships: []
      }
      v_facility_latest: {
        Row: {
          acqsc_site_id: string | null
          approved_bed_size_band: string | null
          care_minutes_period_end: string | null
          care_observed_provider_name: string | null
          care_source_file_name: string | null
          care_source_row_number: number | null
          care_source_sha256: string | null
          care_source_sheet_name: string | null
          care_source_url: string | null
          compliance_rating: number | null
          full_address: string | null
          id: string | null
          is_sample: boolean | null
          latitude: number | null
          location_label: string | null
          longitude: number | null
          met_responsibility: boolean | null
          name: string | null
          overall_rating: number | null
          postcode: string | null
          provider_id: string | null
          provider_name: string | null
          quality_measures_rating: number | null
          residents_experience_rating: number | null
          rn_minutes_actual: number | null
          rn_minutes_target: number | null
          rn_target_percentage: number | null
          staffing_rating: number | null
          star_observed_provider_name: string | null
          star_reporting_month: string | null
          star_source_file_name: string | null
          star_source_row_number: number | null
          star_source_sha256: string | null
          star_source_sheet_name: string | null
          star_source_url: string | null
          state: string | null
          street: string | null
          suburb: string | null
          total_minutes_actual: number | null
          total_minutes_target: number | null
          total_target_percentage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      v_global_search: {
        Row: {
          location: string | null
          object_id: string | null
          object_type: string | null
          provider_id: string | null
          record_mode: string | null
          search_text: string | null
          subtitle: string | null
          title: string | null
        }
        Relationships: []
      }
      v_match_review_history: {
        Row: {
          acqsc_site_id: string | null
          action: string | null
          dataset_code: string | null
          decision_id: number | null
          facility_id: string | null
          facility_name: string | null
          file_name: string | null
          from_status: string | null
          id: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_name: string | null
          row_number: number | null
          sheet_name: string | null
          to_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_match_review_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "facility_match_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "v_match_review_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_match_review_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "v_facility_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      v_match_review_queue: {
        Row: {
          candidate_count: number | null
          candidates: Json | null
          created_at: string | null
          dataset_code: string | null
          evidence: Json | null
          file_name: string | null
          id: number | null
          match_method: string | null
          raw_data: Json | null
          row_number: number | null
          sheet_name: string | null
          source_file_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_records_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_records_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "v_data_import_health"
            referencedColumns: ["source_file_id"]
          },
        ]
      }
      v_opportunities_by_stage: {
        Row: {
          code: string | null
          color: string | null
          estimated_value: number | null
          name: string | null
          opportunity_count: number | null
          position: number | null
          sandbox_opportunity_count: number | null
          stage_id: string | null
        }
        Relationships: []
      }
      v_pipeline_board: {
        Row: {
          blockers: string | null
          currency: string | null
          days_in_stage: number | null
          days_since_last_activity: number | null
          estimated_beds: number | null
          estimated_value: number | null
          expected_close_date: string | null
          id: string | null
          last_activity_at: string | null
          name: string | null
          next_action: string | null
          next_action_due_at: string | null
          next_action_id: string | null
          next_action_overdue: boolean | null
          notes: string | null
          owner_id: string | null
          primary_contact_id: string | null
          primary_contact_name: string | null
          provider_id: string | null
          provider_name: string | null
          record_mode: string | null
          stage_code: string | null
          stage_color: string | null
          stage_entered_at: string | null
          stage_id: string | null
          stage_name: string | null
          stage_position: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "v_provider_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "v_opportunities_by_stage"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      v_provider_overview: {
        Row: {
          abn: string | null
          business_name: string | null
          contact_count: number | null
          current_commercial_activity: string | null
          current_record_mode: string | null
          customer_record_mode: string | null
          customer_status: string | null
          entity_name: string | null
          facility_count: number | null
          first_seen_at: string | null
          id: string | null
          is_sample: boolean | null
          last_activity_at: string | null
          last_seen_at: string | null
          next_action: string | null
          next_action_due_at: string | null
          open_opportunity_count: number | null
          registration_status: string | null
          search_text: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      attach_account_research_response: {
        Args: { p_job_id: string; p_response_id: string }
        Returns: undefined
      }
      complete_account_research: {
        Args: {
          p_claims: Json
          p_job_id: string
          p_response_id: string
          p_sources: Json
          p_token_usage: Json
        }
        Returns: undefined
      }
      fail_account_research: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_job_id: string
        }
        Returns: undefined
      }
      propose_contact_change: {
        Args: {
          p_contact_id: string
          p_intelligence_source_id?: string
          p_note?: string
          p_observed_at?: string
          p_proposal_kind: string
          p_proposed_changes?: Json
          p_source_type?: string
          p_source_url?: string
        }
        Returns: string
      }
      record_provider_workspace_view: {
        Args: { p_provider_id: string }
        Returns: undefined
      }
      research_coverage_snapshot: {
        Args: { p_as_of?: string; p_fresh_days?: number }
        Returns: {
          facility_completed: number
          fresh: number
          needs_refresh: number
          provider_completed: number
          researching: number
        }[]
      }
      reset_sandbox_commercial_data: { Args: never; Returns: Json }
      review_contact_change: {
        Args: {
          p_action: string
          p_proposal_id: string
          p_review_note?: string
        }
        Returns: undefined
      }
      review_facility_match: {
        Args: {
          p_action: string
          p_decision_id: number
          p_facility_id?: string
          p_review_note?: string
        }
        Returns: number
      }
      review_intelligence_claim: {
        Args: {
          p_action: string
          p_claim_id: string
          p_corrected_statement?: string
          p_note?: string
        }
        Returns: undefined
      }
      start_account_research: {
        Args: {
          p_model: string
          p_provider_id: string
          p_provider_snapshot?: Json
          p_request_context?: Json
        }
        Returns: string
      }
      start_scoped_account_research: {
        Args: {
          p_facility_id?: string
          p_model: string
          p_provider_id: string
          p_provider_snapshot?: Json
          p_request_context?: Json
        }
        Returns: string
      }
      update_sandbox_contact: {
        Args: { p_changes: Json; p_contact_id: string; p_provider_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
