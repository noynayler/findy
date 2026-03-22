/**
 * Orchestrates DB cache + Gemini for on-demand Analyze Match.
 */
import type { AiJobMatchAnalysis, Job } from "../types";
import { isSupabaseConfigured } from "../utils/supabaseClient";
import { analyzeMatch } from "./aiService";
import {
  fetchCachedMatchAnalysis,
  fetchJobMatchAnalysisByCvHashAndUrl,
  sha256HexUtf8,
  upsertJobMatchAnalysisRecord,
  upsertMatchHistoryRecord,
} from "./dbService";

export type MatchLoadingPhase = "idle" | "checking-cache" | "calling-ai";

export type MatchAnalysisSource = "cache" | "ai";

export interface MatchAnalysisWithSource extends AiJobMatchAnalysis {
  source: MatchAnalysisSource;
}

function hasGeminiKey(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY?.trim());
}

function stableJobUrl(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u.startsWith("http")) {
    return null;
  }
  return u;
}

export interface LoadOrAnalyzeMatchParams {
  resumeText: string;
  jobDescription: string;
  resumeId: string | null;
  supabaseJobId: string | null;
  /** Canonical listing URL for hash+url cache (required for persistence without jobs table row). */
  jobUrl: string | null;
  /** Minimal job fields stored with analysis for auditing / future UI. */
  jobSnapshot: Pick<Job, "title" | "company" | "location" | "source" | "description" | "url"> | null;
}

/**
 * 1) job_match_analyses by SHA-256(resume text) + job URL (when configured).
 * 2) Legacy match_history by resume_id + job_id (when both present).
 * 3) Else Gemini; persist to job_match_analyses (+ match_history when job row id exists).
 */
export async function loadOrAnalyzeMatch(
  params: LoadOrAnalyzeMatchParams,
  onPhase?: (phase: MatchLoadingPhase) => void,
): Promise<MatchAnalysisWithSource> {
  const {
    resumeText,
    jobDescription,
    resumeId,
    supabaseJobId,
    jobUrl,
    jobSnapshot,
  } = params;

  const finish = (): void => {
    onPhase?.("idle");
  };

  const urlKey = stableJobUrl(jobUrl);
  let cvHash: string | null = null;
  if (isSupabaseConfigured() && resumeText.trim()) {
    try {
      cvHash = await sha256HexUtf8(resumeText.trim());
    } catch {
      cvHash = null;
    }
  }

  if (cvHash && urlKey && isSupabaseConfigured()) {
    onPhase?.("checking-cache");
    try {
      const cached = await fetchJobMatchAnalysisByCvHashAndUrl(cvHash, urlKey);
      if (cached) {
        finish();
        return { ...cached, source: "cache" };
      }
    } catch {
      /* cache miss */
    }
  }

  if (resumeId && supabaseJobId && isSupabaseConfigured()) {
    onPhase?.("checking-cache");
    try {
      const cached = await fetchCachedMatchAnalysis(resumeId, supabaseJobId);
      if (cached) {
        finish();
        return { ...cached, source: "cache" };
      }
    } catch {
      /* treat as cache miss */
    }
  }

  if (!hasGeminiKey()) {
    finish();
    throw new Error(
      "No saved match for this job yet, and VITE_GEMINI_API_KEY is missing. Add a key or run Analyze after a prior result was saved.",
    );
  }

  onPhase?.("calling-ai");
  let data: AiJobMatchAnalysis;
  try {
    data = await analyzeMatch(resumeText, jobDescription);
  } catch (err) {
    finish();
    throw err;
  }

  if (isSupabaseConfigured()) {
    try {
      if (cvHash && urlKey) {
        await upsertJobMatchAnalysisRecord({
          cvContentHash: cvHash,
          jobUrl: urlKey,
          resumeId,
          jobSnapshot,
          score: data.score,
          aiReason: data.reason,
          tips: data.tips,
        });
      } else if (resumeId && supabaseJobId) {
        /* Legacy rows keyed by resume + jobs.id (e.g. data from before in-memory search). */
        await upsertMatchHistoryRecord(
          resumeId,
          supabaseJobId,
          data.score,
          data.reason,
          data.tips,
        );
      }
    } catch {
      /* non-fatal; logged in dbService */
    }
  }

  finish();
  return { ...data, source: "ai" };
}
