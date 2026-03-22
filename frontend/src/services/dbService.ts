/**
 * Supabase / PostgreSQL persistence (resumes, jobs cache, match_history).
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
 * Upsert jobs from search results (Flask scraper or external APIs such as JSearch).
 * Deduplicates by url; returns map url to Supabase job id.
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
