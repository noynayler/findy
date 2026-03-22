/**
 * Google Gemini client-side integration.
 * VITE_GEMINI_API_KEY is public in the bundle — use a backend proxy in production.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiJobMatchAnalysis, Job } from "../types";

const GEMINI_MODEL_ID = "gemini-2.5-flash";

const MAX_RESUME_CHARS = 14_000;
const MAX_JOB_TEXT_CHARS = 12_000;

const GEMINI_PROMPT_PREFIX =
  'Compare this CV to the Job Description. Return ONLY a JSON object with: "score" (0-100), "reason" (short sentence), and "tips" (array of 3 tips to improve the CV for this specific job). No markdown, no code fences, no extra text.';

/** Build one prompt block from structured job fields (used by Gemini). */
export function buildJobDescription(job: Job): string {
  const lines: string[] = [
    `Title: ${job.title ?? "N/A"}`,
    `Company: ${job.company ?? "N/A"}`,
    `Location: ${job.location ?? "N/A"}`,
    `Source: ${job.source ?? "N/A"}`,
  ];
  const desc = job.description?.trim();
  if (desc) {
    lines.push(`Description:\n${desc}`);
  }
  const combined = lines.join("\n");
  return combined.length > MAX_JOB_TEXT_CHARS
    ? combined.slice(0, MAX_JOB_TEXT_CHARS)
    : combined;
}

function stripCodeFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```json")) {
    t = t.slice(7);
  } else if (t.startsWith("```")) {
    t = t.slice(3);
  }
  t = t.trim();
  if (t.endsWith("```")) {
    t = t.slice(0, -3).trim();
  }
  return t;
}

function normalizeTipsFromModel(raw: unknown): [string, string, string] {
  const defaults: [string, string, string] = [
    "Highlight achievements that mirror this role’s responsibilities.",
    "Add measurable outcomes relevant to the job’s tech stack.",
    "Tailor your summary to the company and role keywords above.",
  ];
  if (!Array.isArray(raw)) {
    return defaults;
  }
  const strings = raw.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  const out: string[] = [...strings];
  while (out.length < 3) {
    out.push(
      "Review the job description and align one more bullet with its requirements.",
    );
  }
  return [out[0], out[1], out[2]];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAnalysisJson(text: string): AiJobMatchAnalysis {
  const cleaned = stripCodeFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI response was not valid JSON");
  }
  if (!isPlainObject(parsed)) {
    throw new Error("Invalid AI response shape");
  }
  const scoreRaw = parsed.score;
  const reasonRaw = parsed.reason;
  if (typeof reasonRaw !== "string") {
    throw new Error("Invalid AI response: reason");
  }
  let score = typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);
  if (Number.isNaN(score)) {
    throw new Error("Invalid AI response: score");
  }
  score = Math.min(100, Math.max(0, Math.round(score)));
  const tips = normalizeTipsFromModel(parsed.tips);
  return { score, reason: reasonRaw.trim(), tips };
}

/**
 * Call Gemini with CV + job text; return structured analysis.
 */
export async function analyzeCvVsJob(
  resumeText: string,
  jobDescription: string,
): Promise<AiJobMatchAnalysis> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY. Add it to frontend/.env (see .env.example).",
    );
  }

  const trimmedResume = resumeText.trim().slice(0, MAX_RESUME_CHARS);
  const trimmedJob = jobDescription.trim().slice(0, MAX_JOB_TEXT_CHARS);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_ID });

  const userContent = `${GEMINI_PROMPT_PREFIX}

CV:
${trimmedResume}

Job Description:
${trimmedJob}`;

  try {
    const result = await model.generateContent(userContent);
    const response = result.response;
    const text = response.text();
    if (!text) {
      throw new Error("Empty response from Gemini");
    }
    return parseAnalysisJson(text);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid AI")) {
      throw err;
    }
    if (err instanceof Error) {
      throw new Error(`Gemini request failed: ${err.message}`);
    }
    throw new Error("Gemini request failed");
  }
}

/** Alias for UI actions (same as {@link analyzeCvVsJob}). */
export async function analyzeMatch(
  resumeText: string,
  jobDescription: string,
): Promise<AiJobMatchAnalysis> {
  return analyzeCvVsJob(resumeText, jobDescription);
}
