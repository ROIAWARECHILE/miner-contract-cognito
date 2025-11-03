export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          analysis_type: string
          confidence_score: number | null
          contract_id: string
          created_at: string | null
          created_by: string | null
          embedding: string | null
          id: string
          model_used: string
          model_version: string | null
          pipeline_version: string | null
          processing_stages: Json | null
          processing_time_ms: number | null
          raw_input_text: string | null
          raw_output_json: Json
          structured_output: Json | null
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          analysis_type: string
          confidence_score?: number | null
          contract_id: string
          created_at?: string | null
          created_by?: string | null
          embedding?: string | null
          id?: string
          model_used: string
          model_version?: string | null
          pipeline_version?: string | null
          processing_stages?: Json | null
          processing_time_ms?: number | null
          raw_input_text?: string | null
          raw_output_json: Json
          structured_output?: Json | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          analysis_type?: string
          confidence_score?: number | null
          contract_id?: string
          created_at?: string | null
          created_by?: string | null
          embedding?: string | null
          id?: string
          model_used?: string
          model_version?: string | null
          pipeline_version?: string | null
          processing_stages?: Json | null
          processing_time_ms?: number | null
          raw_input_text?: string | null
          raw_output_json?: Json
          structured_output?: Json | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_date: string
          assigned_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["alert_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          alert_date?: string
          assigned_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          alert_date?: string
          assigned_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      analysis_cache: {
        Row: {
          ai_analysis_id: string | null
          contract_id: string | null
          created_at: string | null
          document_hash: string
          expires_at: string | null
          file_size: number | null
          hit_count: number | null
          id: string
          last_hit_at: string | null
          page_count: number | null
          prompt_version: string | null
        }
        Insert: {
          ai_analysis_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          document_hash: string
          expires_at?: string | null
          file_size?: number | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          page_count?: number | null
          prompt_version?: string | null
        }
        Update: {
          ai_analysis_id?: string | null
          contract_id?: string | null
          created_at?: string | null
          document_hash?: string
          expires_at?: string | null
          file_size?: number | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          page_count?: number | null
          prompt_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_cache_ai_analysis_id_fkey"
            columns: ["ai_analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_cache_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_cache_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      analysis_progress: {
        Row: {
          chunk_index: number
          completed_at: string | null
          contract_id: string
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          tokens_used: number | null
        }
        Insert: {
          chunk_index: number
          completed_at?: string | null
          contract_id: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status: string
          tokens_used?: number | null
        }
        Update: {
          chunk_index?: number
          completed_at?: string | null
          contract_id?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_progress_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_progress_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      assets: {
        Row: {
          capacity_data: Json | null
          coordinates: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          project: string | null
          region: string | null
          status: Database["public"]["Enums"]["asset_status"]
          type: Database["public"]["Enums"]["asset_type"]
          updated_at: string
        }
        Insert: {
          capacity_data?: Json | null
          coordinates?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          project?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Update: {
          capacity_data?: Json | null
          coordinates?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          project?: string | null
          region?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          diff_json: Json | null
          entity_id: string
          entity_type: string
          id: string
          timestamp: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          diff_json?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          diff_json?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          timestamp?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_entity_id: string | null
          context_page: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          context_entity_id?: string | null
          context_page?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          context_entity_id?: string | null
          context_page?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clause_embeddings: {
        Row: {
          clause_id: string
          created_at: string
          embedding: string | null
          id: string
        }
        Insert: {
          clause_id: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Update: {
          clause_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clause_embeddings_clause_id_fkey"
            columns: ["clause_id"]
            isOneToOne: false
            referencedRelation: "clauses"
            referencedColumns: ["id"]
          },
        ]
      }
      clauses: {
        Row: {
          ai_notes: string | null
          category: Database["public"]["Enums"]["clause_category"]
          contract_id: string
          created_at: string
          deviation_score: number | null
          id: string
          importance: Database["public"]["Enums"]["clause_importance"]
          page_number: number | null
          text: string
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          category: Database["public"]["Enums"]["clause_category"]
          contract_id: string
          created_at?: string
          deviation_score?: number | null
          id?: string
          importance?: Database["public"]["Enums"]["clause_importance"]
          page_number?: number | null
          text: string
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          category?: Database["public"]["Enums"]["clause_category"]
          contract_id?: string
          created_at?: string
          deviation_score?: number | null
          id?: string
          importance?: Database["public"]["Enums"]["clause_importance"]
          page_number?: number | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          rating: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          rating?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          rating?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contract_anomalies: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          anomaly_type: string
          contract_id: string
          description: string
          detected_at: string
          id: string
          metadata: Json | null
          recommendation: string | null
          severity: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomaly_type: string
          contract_id: string
          description: string
          detected_at?: string
          id?: string
          metadata?: Json | null
          recommendation?: string | null
          severity: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          anomaly_type?: string
          contract_id?: string
          description?: string
          detected_at?: string
          id?: string
          metadata?: Json | null
          recommendation?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_anomalies_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_anomalies_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_embeddings: {
        Row: {
          content_summary: string | null
          contract_id: string
          created_at: string
          embedding: string | null
          id: string
          updated_at: string
        }
        Insert: {
          content_summary?: string | null
          contract_id: string
          created_at?: string
          embedding?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          content_summary?: string | null
          contract_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_embeddings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_embeddings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_tasks: {
        Row: {
          budget_uf: number | null
          contract_id: string
          created_at: string | null
          id: string
          progress_percentage: number | null
          spent_uf: number | null
          task_name: string
          task_number: string
          updated_at: string | null
        }
        Insert: {
          budget_uf?: number | null
          contract_id: string
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
          spent_uf?: number | null
          task_name: string
          task_number: string
          updated_at?: string | null
        }
        Update: {
          budget_uf?: number | null
          contract_id?: string
          created_at?: string | null
          id?: string
          progress_percentage?: number | null
          spent_uf?: number | null
          task_name?: string
          task_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_text_chunks: {
        Row: {
          char_count: number | null
          chunk_index: number
          chunk_type: string
          content: string
          contract_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          page_end: number | null
          page_start: number | null
          word_count: number | null
        }
        Insert: {
          char_count?: number | null
          chunk_index: number
          chunk_type: string
          content: string
          contract_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          word_count?: number | null
        }
        Update: {
          char_count?: number | null
          chunk_index?: number
          chunk_type?: string
          content?: string
          contract_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_text_chunks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_text_chunks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contracts: {
        Row: {
          asset_id: string | null
          code: string
          company_id: string | null
          contract_value: number | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          document_url: string | null
          end_date: string | null
          id: string
          metadata: Json | null
          mineral: string | null
          risk_label: Database["public"]["Enums"]["risk_level"] | null
          risk_score: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          summary_ai: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          code: string
          company_id?: string | null
          contract_value?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          mineral?: string | null
          risk_label?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          summary_ai?: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          code?: string
          company_id?: string | null
          contract_value?: number | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          mineral?: string | null
          risk_label?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          summary_ai?: string | null
          title?: string
          type?: Database["public"]["Enums"]["contract_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          contract_id: string
          created_at: string | null
          embedding: string | null
          id: string
          level: number
          metadata: Json | null
          number: string | null
          page_end: number | null
          page_start: number | null
          parent_chunk_id: string | null
          title: string | null
          token_count: number | null
          type: string
        }
        Insert: {
          chunk_index: number
          content: string
          contract_id: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          level?: number
          metadata?: Json | null
          number?: string | null
          page_end?: number | null
          page_start?: number | null
          parent_chunk_id?: string | null
          title?: string | null
          token_count?: number | null
          type: string
        }
        Update: {
          chunk_index?: number
          content?: string
          contract_id?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          level?: number
          metadata?: Json | null
          number?: string | null
          page_end?: number | null
          page_start?: number | null
          parent_chunk_id?: string | null
          title?: string | null
          token_count?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "document_chunks_parent_chunk_id_fkey"
            columns: ["parent_chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          checksum: string | null
          contract_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          extracted_data: Json | null
          file_size: number | null
          file_url: string
          filename: string
          id: string
          processing_status: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          checksum?: string | null
          contract_id: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          extracted_data?: Json | null
          file_size?: number | null
          file_url: string
          filename: string
          id?: string
          processing_status?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          checksum?: string | null
          contract_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          extracted_data?: Json | null
          file_size?: number | null
          file_url?: string
          filename?: string
          id?: string
          processing_status?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      extraction_metrics: {
        Row: {
          contract_id: string | null
          cost_usd: number | null
          created_at: string | null
          error_message: string | null
          extraction_method: string
          file_size_bytes: number
          has_ocr: boolean | null
          id: string
          metadata: Json | null
          pages_processed: number | null
          processing_time_ms: number | null
          quality_score: number | null
          tables_found: number | null
          text_length: number
        }
        Insert: {
          contract_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          extraction_method: string
          file_size_bytes: number
          has_ocr?: boolean | null
          id?: string
          metadata?: Json | null
          pages_processed?: number | null
          processing_time_ms?: number | null
          quality_score?: number | null
          tables_found?: number | null
          text_length: number
        }
        Update: {
          contract_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          error_message?: string | null
          extraction_method?: string
          file_size_bytes?: number
          has_ocr?: boolean | null
          id?: string
          metadata?: Json | null
          pages_processed?: number | null
          processing_time_ms?: number | null
          quality_score?: number | null
          tables_found?: number | null
          text_length?: number
        }
        Relationships: [
          {
            foreignKeyName: "extraction_metrics_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_metrics_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          content: string | null
          created_at: string
          file_url: string | null
          generated_by: string
          id: string
          metadata: Json | null
          report_type: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          generated_by: string
          id?: string
          metadata?: Json | null
          report_type: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          generated_by?: string
          id?: string
          metadata?: Json | null
          report_type?: string
          title?: string
        }
        Relationships: []
      }
      ingest_jobs: {
        Row: {
          attempts: number | null
          contract_id: string | null
          created_at: string | null
          document_type: string | null
          etag: string | null
          file_hash: string | null
          id: string
          last_error: string | null
          project_prefix: string
          status: string | null
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          contract_id?: string | null
          created_at?: string | null
          document_type?: string | null
          etag?: string | null
          file_hash?: string | null
          id?: string
          last_error?: string | null
          project_prefix: string
          status?: string | null
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          contract_id?: string | null
          created_at?: string | null
          document_type?: string | null
          etag?: string | null
          file_hash?: string | null
          id?: string
          last_error?: string | null
          project_prefix?: string
          status?: string | null
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_jobs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingest_jobs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      ingest_logs: {
        Row: {
          created_at: string | null
          id: number
          job_id: string | null
          message: string | null
          meta: Json | null
          step: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          job_id?: string | null
          message?: string | null
          meta?: Json | null
          step?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          job_id?: string | null
          message?: string | null
          meta?: Json | null
          step?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingest_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          completed_at: string | null
          contract_id: string
          created_at: string
          criticality: Database["public"]["Enums"]["clause_importance"]
          description: string
          due_date: string | null
          id: string
          notes: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["obligation_status"]
          type: Database["public"]["Enums"]["obligation_type"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contract_id: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["clause_importance"]
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          type: Database["public"]["Enums"]["obligation_type"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contract_id?: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["clause_importance"]
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          type?: Database["public"]["Enums"]["obligation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      payment_states: {
        Row: {
          amount_clp: number | null
          amount_uf: number | null
          approval_date: string | null
          contract_id: string
          created_at: string | null
          data: Json | null
          edp_number: number
          id: string
          period_end: string | null
          period_label: string | null
          period_start: string | null
          status: string
          uf_rate: number | null
          updated_at: string | null
        }
        Insert: {
          amount_clp?: number | null
          amount_uf?: number | null
          approval_date?: string | null
          contract_id: string
          created_at?: string | null
          data?: Json | null
          edp_number: number
          id?: string
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          status?: string
          uf_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_clp?: number | null
          amount_uf?: number | null
          approval_date?: string | null
          contract_id?: string
          created_at?: string | null
          data?: Json | null
          edp_number?: number
          id?: string
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          status?: string
          uf_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_states_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_states_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      permits: {
        Row: {
          asset_id: string
          authority: string
          conditions_json: Json | null
          created_at: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          name: string
          number: string | null
          status: Database["public"]["Enums"]["permit_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          authority: string
          conditions_json?: Json | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          name: string
          number?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          authority?: string
          conditions_json?: Json | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          name?: string
          number?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permits_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_changes: {
        Row: {
          affected_contracts_count: number | null
          category: string
          description: string
          detected_at: string
          effective_date: string | null
          id: string
          impact_level: string | null
          jurisdiction: string
          metadata: Json | null
          source_url: string | null
          title: string
        }
        Insert: {
          affected_contracts_count?: number | null
          category: string
          description: string
          detected_at?: string
          effective_date?: string | null
          id?: string
          impact_level?: string | null
          jurisdiction: string
          metadata?: Json | null
          source_url?: string | null
          title: string
        }
        Update: {
          affected_contracts_count?: number | null
          category?: string
          description?: string
          detected_at?: string
          effective_date?: string | null
          id?: string
          impact_level?: string | null
          jurisdiction?: string
          metadata?: Json | null
          source_url?: string | null
          title?: string
        }
        Relationships: []
      }
      regulatory_impacts: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          impact_description: string
          recommended_action: string | null
          regulatory_change_id: string
          severity: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          impact_description: string
          recommended_action?: string | null
          regulatory_change_id: string
          severity: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          impact_description?: string
          recommended_action?: string | null
          regulatory_change_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_impacts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_impacts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "regulatory_impacts_regulatory_change_id_fkey"
            columns: ["regulatory_change_id"]
            isOneToOne: false
            referencedRelation: "regulatory_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          relation_type: Database["public"]["Enums"]["relationship_type"]
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          relation_type: Database["public"]["Enums"]["relationship_type"]
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          relation_type?: Database["public"]["Enums"]["relationship_type"]
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      renewal_predictions: {
        Row: {
          confidence_level: string
          contract_id: string
          expires_at: string
          factors: Json
          id: string
          predicted_at: string
          probability_score: number
          recommendations: string | null
        }
        Insert: {
          confidence_level: string
          contract_id: string
          expires_at?: string
          factors: Json
          id?: string
          predicted_at?: string
          probability_score: number
          recommendations?: string | null
        }
        Update: {
          confidence_level?: string
          contract_id?: string
          expires_at?: string
          factors?: Json
          id?: string
          predicted_at?: string
          probability_score?: number
          recommendations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_predictions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_predictions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      risk_events: {
        Row: {
          contract_id: string
          created_at: string
          created_by_ai: boolean | null
          description: string
          id: string
          recommendation: string | null
          severity: number | null
          source_clause_id: string | null
          type: Database["public"]["Enums"]["risk_event_type"]
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          created_by_ai?: boolean | null
          description: string
          id?: string
          recommendation?: string | null
          severity?: number | null
          source_clause_id?: string | null
          type: Database["public"]["Enums"]["risk_event_type"]
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          created_by_ai?: boolean | null
          description?: string
          id?: string
          recommendation?: string | null
          severity?: number | null
          source_clause_id?: string | null
          type?: Database["public"]["Enums"]["risk_event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "risk_events_source_clause_id_fkey"
            columns: ["source_clause_id"]
            isOneToOne: false
            referencedRelation: "clauses"
            referencedColumns: ["id"]
          },
        ]
      }
      royalty_terms: {
        Row: {
          contract_id: string
          created_at: string
          floor_value: number | null
          formula_text: string
          id: string
          index_ref: string | null
          notes_ai: string | null
          penalty_json: Json | null
          scales_json: Json | null
          tc_rc: number | null
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          floor_value?: number | null
          formula_text: string
          id?: string
          index_ref?: string | null
          notes_ai?: string | null
          penalty_json?: Json | null
          scales_json?: Json | null
          tc_rc?: number | null
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          floor_value?: number | null
          formula_text?: string
          id?: string
          index_ref?: string | null
          notes_ai?: string | null
          penalty_json?: Json | null
          scales_json?: Json | null
          tc_rc?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "royalty_terms_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "royalty_terms_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "view_contract_overview"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      standard_clauses: {
        Row: {
          category: Database["public"]["Enums"]["clause_category"]
          created_at: string
          created_by: string | null
          id: string
          importance: Database["public"]["Enums"]["clause_importance"]
          is_active: boolean | null
          notes: string | null
          text: string
          title: string
          updated_at: string
          version: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["clause_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["clause_importance"]
          is_active?: boolean | null
          notes?: string | null
          text: string
          title: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["clause_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["clause_importance"]
          is_active?: boolean | null
          notes?: string | null
          text?: string
          title?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      analysis_quality_metrics: {
        Row: {
          avg_confidence_score: number | null
          avg_processing_time_ms: number | null
          avg_tokens_used: number | null
          total_analyses: number | null
          total_tokens_used: number | null
          unique_contracts_analyzed: number | null
        }
        Relationships: []
      }
      view_contract_overview: {
        Row: {
          available_uf: number | null
          budget_uf: number | null
          code: string | null
          contract_id: string | null
          edps_paid: number | null
          progress_pct: number | null
          spent_uf: number | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_contract_cascade: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      get_next_ingest_job: {
        Args: never
        Returns: {
          attempts: number | null
          contract_id: string | null
          created_at: string | null
          document_type: string | null
          etag: string | null
          file_hash: string | null
          id: string
          last_error: string | null
          project_prefix: string
          status: string | null
          storage_path: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ingest_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_contract_analyses: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          analysis_type: string
          contract_id: string
          created_at: string
          id: string
          similarity: number
          summary: string
        }[]
      }
      match_document_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_contract_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          contract_id: string
          id: string
          metadata: Json
          page_end: number
          page_start: number
          similarity: number
          title: string
          type: string
        }[]
      }
    }
    Enums: {
      alert_priority: "low" | "medium" | "high" | "critical"
      alert_status:
        | "new"
        | "acknowledged"
        | "in_progress"
        | "resolved"
        | "dismissed"
      app_role:
        | "admin"
        | "legal_counsel"
        | "technical_user"
        | "esg_user"
        | "auditor"
      asset_status:
        | "active"
        | "inactive"
        | "under_construction"
        | "maintenance"
        | "decommissioned"
      asset_type:
        | "mine"
        | "plant"
        | "port"
        | "warehouse"
        | "office"
        | "camp"
        | "infrastructure"
        | "exploration"
        | "other"
      clause_category:
        | "royalty"
        | "pricing"
        | "force_majeure"
        | "guarantee"
        | "esg_hsec"
        | "termination"
        | "confidentiality"
        | "payment"
        | "delivery"
        | "liability"
        | "dispute_resolution"
        | "intellectual_property"
        | "regulatory"
        | "other"
      clause_importance: "low" | "medium" | "high" | "critical"
      contract_status:
        | "draft"
        | "under_review"
        | "active"
        | "expired"
        | "terminated"
        | "suspended"
      contract_type:
        | "offtake"
        | "joint_venture"
        | "concession"
        | "royalty"
        | "logistics"
        | "community"
        | "environmental"
        | "nda"
        | "servitude"
        | "supply"
        | "service"
        | "other"
      document_type:
        | "original"
        | "addendum"
        | "annex"
        | "amendment"
        | "certificate"
        | "report"
        | "correspondence"
        | "other"
      obligation_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "overdue"
        | "cancelled"
      obligation_type:
        | "reporting"
        | "payment"
        | "environmental"
        | "social"
        | "logistics"
        | "guarantee"
        | "permit_renewal"
        | "compliance"
        | "audit"
        | "other"
      permit_status:
        | "active"
        | "pending"
        | "expired"
        | "suspended"
        | "cancelled"
      relationship_type:
        | "applies_to"
        | "contains"
        | "refers_to"
        | "related_to"
        | "supersedes"
        | "amends"
      risk_event_type:
        | "temporal"
        | "financial"
        | "operational"
        | "regulatory"
        | "counterparty"
        | "esg"
        | "legal"
      risk_level: "low" | "medium" | "high" | "critical"
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
  public: {
    Enums: {
      alert_priority: ["low", "medium", "high", "critical"],
      alert_status: [
        "new",
        "acknowledged",
        "in_progress",
        "resolved",
        "dismissed",
      ],
      app_role: [
        "admin",
        "legal_counsel",
        "technical_user",
        "esg_user",
        "auditor",
      ],
      asset_status: [
        "active",
        "inactive",
        "under_construction",
        "maintenance",
        "decommissioned",
      ],
      asset_type: [
        "mine",
        "plant",
        "port",
        "warehouse",
        "office",
        "camp",
        "infrastructure",
        "exploration",
        "other",
      ],
      clause_category: [
        "royalty",
        "pricing",
        "force_majeure",
        "guarantee",
        "esg_hsec",
        "termination",
        "confidentiality",
        "payment",
        "delivery",
        "liability",
        "dispute_resolution",
        "intellectual_property",
        "regulatory",
        "other",
      ],
      clause_importance: ["low", "medium", "high", "critical"],
      contract_status: [
        "draft",
        "under_review",
        "active",
        "expired",
        "terminated",
        "suspended",
      ],
      contract_type: [
        "offtake",
        "joint_venture",
        "concession",
        "royalty",
        "logistics",
        "community",
        "environmental",
        "nda",
        "servitude",
        "supply",
        "service",
        "other",
      ],
      document_type: [
        "original",
        "addendum",
        "annex",
        "amendment",
        "certificate",
        "report",
        "correspondence",
        "other",
      ],
      obligation_status: [
        "pending",
        "in_progress",
        "completed",
        "overdue",
        "cancelled",
      ],
      obligation_type: [
        "reporting",
        "payment",
        "environmental",
        "social",
        "logistics",
        "guarantee",
        "permit_renewal",
        "compliance",
        "audit",
        "other",
      ],
      permit_status: ["active", "pending", "expired", "suspended", "cancelled"],
      relationship_type: [
        "applies_to",
        "contains",
        "refers_to",
        "related_to",
        "supersedes",
        "amends",
      ],
      risk_event_type: [
        "temporal",
        "financial",
        "operational",
        "regulatory",
        "counterparty",
        "esg",
        "legal",
      ],
      risk_level: ["low", "medium", "high", "critical"],
    },
  },
} as const
