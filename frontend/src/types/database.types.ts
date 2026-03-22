/**
 * PostgreSQL public schema — keep in sync with `postgresql/schema.sql`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      resumes: {
        Row: {
          id: string;
          content: string;
          file_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          file_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          file_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          title: string;
          company: string;
          description: string;
          url: string;
          location: string;
          source: string;
          date_posted: string | null;
          raw_json: Json;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          title?: string;
          company?: string;
          description?: string;
          url: string;
          location?: string;
          source?: string;
          date_posted?: string | null;
          raw_json?: Json;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          company?: string;
          description?: string;
          url?: string;
          location?: string;
          source?: string;
          date_posted?: string | null;
          raw_json?: Json;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      match_history: {
        Row: {
          id: string;
          resume_id: string;
          job_id: string;
          score: number;
          ai_reason: string;
          tips: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          job_id: string;
          score: number;
          ai_reason: string;
          tips?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          resume_id?: string;
          job_id?: string;
          score?: number;
          ai_reason?: string;
          tips?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
