/**
 * Domain types for Findy (resume upload + job search).
 */

import type { Database } from "./database.types";

export type { Database } from "./database.types";

/** Supabase `public.resumes` row shape. */
export type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
/** Supabase `public.jobs` row shape. */
export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
/** Supabase `public.match_history` row shape. */
export type MatchHistoryRow = Database["public"]["Tables"]["match_history"]["Row"];

/** Extracted resume text + optional Supabase id after persistence. */
export interface Candidate {
  resumeText: string | null;
  /** Length of extracted text after a successful upload */
  textLength: number | null;
  /** Supabase `resumes.id` after successful insert; null if skipped or failed */
  resumeId: string | null;
}

export type ResumeUploadStatus = "idle" | "uploading" | "success" | "error";

export type SeniorityValue =
  | ""
  | "intern"
  | "entry-level"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "manager";

export interface Job {
  title?: string;
  company?: string;
  location?: string;
  date_posted?: string | null;
  url?: string;
  /** Supabase `jobs.id` after cache upsert (for match_history). */
  supabase_job_id?: string;
  source?: string;
  description?: string;
  seniority_label?: string;
  seniority_reason?: string;
  min_years?: number | null;
  max_years?: number | null;
  /** Legacy keyword match (server); not used when AI match is enabled in UI. */
  match_score?: number | null;
  matching_skills?: string[];
  missing_skills?: string[];
  matched_keywords?: string[];
  missing_keywords?: string[];
}

/** Parsed Gemini response for CV vs job comparison (strict JSON from model). */
export interface AiJobMatchAnalysis {
  score: number;
  reason: string;
  tips: [string, string, string];
}

/**
 * On-demand AI match result for a single job card (Gemini).
 * Same shape as AiJobMatchAnalysis; not the legacy keyword JobMatchResult.
 */
export type JobCardAiMatchResult = AiJobMatchAnalysis;

/** Normalized match display for a single job (legacy keyword flow). */
export interface JobMatchResult {
  job: Job;
  matchScore: number | null;
  matchingSkills: string[];
  missingSkills: string[];
}

/** POST /api/resume/upload */
export interface ResumeUploadSuccessResponse {
  success: true;
  resume_text: string;
  text_length: number;
}

export interface ResumeUploadFailureResponse {
  success: false;
  error: string;
}

export type ResumeUploadResponse =
  | ResumeUploadSuccessResponse
  | ResumeUploadFailureResponse;

/** POST /api/jobs/search body */
export interface JobsSearchRequestBody {
  days: number;
  title?: string;
  seniority?: string;
  resume_text?: string;
}

export interface JobsSearchSuccessResponse {
  success: true;
  jobs: Job[];
  matched?: boolean;
  total_count?: number;
  filtered?: boolean;
}

export interface JobsSearchFailureResponse {
  success: false;
  error: string;
}

export type JobsSearchResponse =
  | JobsSearchSuccessResponse
  | JobsSearchFailureResponse;
