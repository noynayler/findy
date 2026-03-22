/**
 * Orchestrates DB cache + Gemini for on-demand Analyze Match.
 */
import type { AiJobMatchAnalysis } from "../types";
import { isSupabaseConfigured } from "../utils/supabaseClient";
import { analyzeMatch } from "./aiService";
import {
  fetchCachedMatchAnalysis,
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

export interface LoadOrAnalyzeMatchParams {
  resumeText: string;
  jobDescription: string;
  resumeId: string | null;
  supabaseJobId: string | null;
}

/**
 * 1) Query match_history by resume_id + job_id — if hit, return (no Gemini).
 * 2) Else call Gemini and upsert match_history.
 * Works without Supabase (Gemini only, no persistence).
 */
export async function loadOrAnalyzeMatch(
  params: LoadOrAnalyzeMatchParams,
  onPhase?: (phase: MatchLoadingPhase) => void,
): Promise<MatchAnalysisWithSource> {
  const { resumeText, jobDescription, resumeId, supabaseJobId } = params;

  const finish = (): void => {
    onPhase?.("idle");
  };

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

  /* Next step is always a Gemini call (cache miss or no Supabase ids). */
  onPhase?.("calling-ai");
  let data: AiJobMatchAnalysis;
  try {
    data = await analyzeMatch(resumeText, jobDescription);
  } catch (err) {
    finish();
    throw err;
  }

  if (resumeId && supabaseJobId && isSupabaseConfigured()) {
    try {
      await upsertMatchHistoryRecord(
        resumeId,
        supabaseJobId,
        data.score,
        data.reason,
        data.tips,
      );
    } catch {
      /* non-fatal; logged in dbService */
    }
  }

  finish();
  return { ...data, source: "ai" };
}
