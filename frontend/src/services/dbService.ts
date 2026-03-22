/**
 * Supabase / PostgreSQL persistence (resumes, optional jobs cache, match analyses).
 */
import type { AiJobMatchAnalysis, Job } from "../types";
import type { Database, Json } from "../types/database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../utils/supabaseClient";

type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];

const UPSERT_CHUNK = 150;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** SHA-256 hex of UTF-8 resume text (stable cache key for CV content). */
export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jobSnapshotJson(
  snap: Pick<Job, "title" | "company" | "location" | "source" | "description" | "url"> | null,
): Json {
  if (!snap) {
    return {} as Json;
  }
  const desc = snap.description ?? "";
  return {
    title: snap.title ?? "",
    company: snap.company ?? "",
    location: snap.location ?? "",
    source: snap.source ?? "",
    url: snap.url ?? "",
    description: desc.length > 8000 ? desc.slice(0, 8000) : desc,
  } as Json;
}

function tipsFromJsonColumn(raw: Json | null | undefined): [string, string, string] {
  const fallback: [string, string, string] = [
    "Highlight achievements aligned with this role.",
    "Add measurable impact for relevant tools and stacks.",
    "Tweak your summary to reflect this job's keywords.",
  ];
  if (!Array.isArray(raw)) {
    return fallback;
  }
  const strings = raw.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  const out: string[] = [...strings];
  while (out.length < 3) {
    out.push(fallback[out.length]);
  }
  return [out[0], out[1], out[2]];
}

function tipsToJson(tips: [string, string, string]): Json {
  return [tips[0], tips[1], tips[2]] as Json;
}

/**
 * Persist parsed resume text after Flask PDF extraction. Returns new row id or null.
 */
export async function insertResumeRecord(
  content: string,
  fileName: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("resumes")
      .insert({ content, file_name: fileName })
      .select("id")
      .single();
    if (error) {
      console.warn("[dbService] insert resume:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[dbService] insert resume exception:", e);
    return null;
  }
}

/**
 * Upsert jobs from search results so the UI gets `supabase_job_id` for legacy match_history.
 * Idempotent on `url` (same rows as Flask refresh); safe to call after each DB-backed search.
 */
export async function upsertJobsCache(jobs: Job[]): Promise<Record<string, string>> {
  const urlToId: Record<string, string> = {};
  if (!isSupabaseConfigured()) {
    return urlToId;
  }

  const byUrl = new Map<string, JobInsert>();
  for (const j of jobs) {
    if (typeof j.url !== "string" || !j.url.startsWith("http")) {
      continue;
    }
    byUrl.set(j.url, {
      title: j.title ?? "",
      company: j.company ?? "",
      description: j.description ?? "",
      url: j.url,
      location: j.location ?? "",
    });
  }
  const rows: JobInsert[] = [...byUrl.values()];

  if (rows.length === 0) {
    return urlToId;
  }

  try {
    const supabase = getSupabaseClient();
    for (const chunk of chunkArray(rows, UPSERT_CHUNK)) {
      const { data, error } = await supabase
        .from("jobs")
        .upsert(chunk, { onConflict: "url" })
        .select("id, url");
      if (error) {
        console.warn("[dbService] upsert jobs:", error.message);
        continue;
      }
      for (const row of data ?? []) {
        urlToId[row.url] = row.id;
      }
    }
  } catch (e) {
    console.warn("[dbService] upsert jobs exception:", e);
  }
  return urlToId;
}

/** Read cached analysis by CV content hash + canonical job URL. */
export async function fetchJobMatchAnalysisByCvHashAndUrl(
  cvContentHash: string,
  jobUrl: string,
): Promise<AiJobMatchAnalysis | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("job_match_analyses")
      .select("score, ai_reason, tips")
      .eq("cv_content_hash", cvContentHash)
      .eq("job_url", jobUrl)
      .maybeSingle();

    if (error) {
      console.warn("[dbService] fetch job_match_analyses:", error.message);
      return null;
    }
    if (!data) {
      return null;
    }
    return {
      score: data.score,
      reason: data.ai_reason,
      tips: tipsFromJsonColumn(data.tips),
    };
  } catch (e) {
    console.warn("[dbService] fetch job_match_analyses exception:", e);
    return null;
  }
}

export interface UpsertJobMatchAnalysisInput {
  cvContentHash: string;
  jobUrl: string;
  resumeId: string | null;
  jobSnapshot: Pick<Job, "title" | "company" | "location" | "source" | "description" | "url"> | null;
  score: number;
  aiReason: string;
  tips: [string, string, string];
}

/** Upsert row in job_match_analyses (unique cv_content_hash + job_url). */
export async function upsertJobMatchAnalysisRecord(input: UpsertJobMatchAnalysisInput): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const {
    cvContentHash,
    jobUrl,
    resumeId,
    jobSnapshot,
    score,
    aiReason,
    tips,
  } = input;
  try {
    const supabase = getSupabaseClient();
    const safeScore = Math.round(Math.min(100, Math.max(0, score)));
    const now = new Date().toISOString();
    const { error } = await supabase.from("job_match_analyses").upsert(
      {
        cv_content_hash: cvContentHash,
        job_url: jobUrl,
        resume_id: resumeId,
        job_snapshot: jobSnapshotJson(jobSnapshot),
        score: safeScore,
        ai_reason: aiReason,
        tips: tipsToJson(tips),
        updated_at: now,
      },
      { onConflict: "cv_content_hash,job_url" },
    );
    if (error) {
      console.warn("[dbService] upsert job_match_analyses:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[dbService] upsert job_match_analyses exception:", e);
    return false;
  }
}

/** Read cached Gemini result for resume + job pair. */
export async function fetchCachedMatchAnalysis(
  resumeId: string,
  jobId: string,
): Promise<AiJobMatchAnalysis | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("match_history")
      .select("score, ai_reason, tips")
      .eq("resume_id", resumeId)
      .eq("job_id", jobId)
      .maybeSingle();

    if (error) {
      console.warn("[dbService] fetch match_history:", error.message);
      return null;
    }
    if (!data) {
      return null;
    }
    return {
      score: data.score,
      reason: data.ai_reason,
      tips: tipsFromJsonColumn(data.tips),
    };
  } catch (e) {
    console.warn("[dbService] fetch match_history exception:", e);
    return null;
  }
}

/** Upsert match row after Gemini (unique resume_id + job_id). */
export async function upsertMatchHistoryRecord(
  resumeId: string,
  jobId: string,
  score: number,
  aiReason: string,
  tips: [string, string, string],
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }
  try {
    const supabase = getSupabaseClient();
    const safeScore = Math.round(Math.min(100, Math.max(0, score)));
    const { error } = await supabase.from("match_history").upsert(
      {
        resume_id: resumeId,
        job_id: jobId,
        score: safeScore,
        ai_reason: aiReason,
        tips: tipsToJson(tips),
      },
      { onConflict: "resume_id,job_id" },
    );
    if (error) {
      console.warn("[dbService] upsert match_history:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[dbService] upsert match_history exception:", e);
    return false;
  }
}
