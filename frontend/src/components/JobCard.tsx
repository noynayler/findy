import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Job } from "../types";
import { buildJobDescription } from "../services/aiService";
import {
  loadOrAnalyzeMatch,
  type MatchAnalysisWithSource,
  type MatchLoadingPhase,
} from "../services/matchService";

export interface JobCardProps {
  job: Job;
  resumeText: string | null;
  /** Supabase `resumes.id` for match_history. */
  resumeId: string | null;
}

function seniorityDataAttribute(label: string): string {
  if (label.startsWith("entry")) return "entry";
  return label;
}

function scoreBadgeClasses(score: number): string {
  if (score >= 80) {
    return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  }
  if (score >= 50) {
    return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  }
  return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
}

function loadingPhaseLabel(phase: MatchLoadingPhase): string {
  if (phase === "checking-cache") return "Checking saved match…";
  if (phase === "calling-ai") return "Analyzing with AI…";
  return "Working…";
}

export const JobCard: FC<JobCardProps> = ({ job, resumeText, resumeId }) => {
  const [matchResult, setMatchResult] = useState<MatchAnalysisWithSource | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [matchPhase, setMatchPhase] = useState<MatchLoadingPhase>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [tipsModalOpen, setTipsModalOpen] = useState<boolean>(false);

  const jobDescription = useMemo(
    () => buildJobDescription(job),
    [job.title, job.company, job.location, job.source, job.description],
  );

  const jobUrl = job.url ?? "#";
  const jobTitle = job.title ?? "Job";

  const hasApiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY?.trim());
  const trimmedResume = resumeText?.trim() ?? "";
  const hasResume = trimmedResume.length > 0;

  useEffect(() => {
    setMatchResult(null);
    setAnalysisError(null);
    setTipsModalOpen(false);
    setAnalysisLoading(false);
    setMatchPhase("idle");
  }, [trimmedResume, jobDescription]);

  const handleAnalyzeMatch = useCallback(async (): Promise<void> => {
    if (matchResult !== null) {
      return;
    }
    if (!hasResume) {
      setAnalysisError("Upload your CV first.");
      return;
    }

    setAnalysisLoading(true);
    setMatchPhase("idle");
    setAnalysisError(null);

    try {
      const data = await loadOrAnalyzeMatch(
        {
          resumeText: trimmedResume,
          jobDescription,
          resumeId,
          supabaseJobId: job.supabase_job_id ?? null,
        },
        (phase) => {
          setMatchPhase(phase);
        },
      );
      setMatchResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI analysis failed";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
      setMatchPhase("idle");
    }
  }, [
    hasResume,
    jobDescription,
    matchResult,
    trimmedResume,
    resumeId,
    job.supabase_job_id,
  ]);

  const openTips = useCallback((): void => {
    if (matchResult) {
      setTipsModalOpen(true);
    }
  }, [matchResult]);

  const closeTips = useCallback((): void => {
    setTipsModalOpen(false);
  }, []);

  const applyClick = useCallback((): void => {
    if (jobUrl && jobUrl !== "#") {
      window.open(jobUrl, "_blank", "noopener,noreferrer");
    }
  }, [jobUrl]);

  useEffect(() => {
    if (!tipsModalOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setTipsModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tipsModalOpen]);

  try {
    const seniorityLabel = job.seniority_label ?? "unknown";
    const seniorityDisplay =
      seniorityLabel.charAt(0).toUpperCase() + seniorityLabel.slice(1);
    let yearsDisplay = "";
    if (job.min_years != null) {
      yearsDisplay =
        job.max_years != null
          ? `${job.min_years}-${job.max_years} years`
          : `${job.min_years}+ years`;
    }
    const reason = job.seniority_reason ?? "";
    const dateDisplay = job.date_posted
      ? new Date(job.date_posted).toLocaleDateString()
      : "Date unknown";

    const analyzed = matchResult !== null;
    // Cache hit needs no Gemini key; first-time analysis needs VITE_GEMINI_API_KEY.
    const analyzeDisabled = analysisLoading || analyzed || !hasResume;

    return (
      <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 ease-out hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              <a
                href={jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {jobTitle}
              </a>
            </h3>
            <p className="mt-1 font-medium text-slate-700">{job.company ?? ""}</p>
            <p className="mt-1 text-sm text-slate-500">
              📍 {job.location ?? "Location not specified"}
            </p>
            <p className="text-sm text-slate-500">📅 {dateDisplay}</p>
          </div>

          <div
            className={`flex min-h-[2.25rem] shrink-0 flex-col items-stretch justify-center gap-2 transition-opacity duration-200 sm:items-end ${
              analyzed ? "opacity-100" : "opacity-90"
            }`}
          >
            {!hasApiKey && (!resumeId || !job.supabase_job_id) ? (
              <span
                className="inline-flex max-w-xs rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
                title="Set VITE_GEMINI_API_KEY for first-time analysis (cached matches work without it)"
              >
                Gemini key needed for new matches
              </span>
            ) : null}
            {!hasResume ? (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                Upload CV to analyze match
              </span>
            ) : null}
            {analysisError && !analyzed ? (
              <span
                className="inline-flex max-w-[14rem] rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-800 ring-1 ring-rose-200"
                title={analysisError}
              >
                {analysisError.length > 40
                  ? `${analysisError.slice(0, 40)}…`
                  : analysisError}
              </span>
            ) : null}
            {analysisLoading ? (
              <div
                className="inline-flex max-w-[16rem] items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 ring-1 ring-indigo-200"
                aria-busy="true"
                aria-live="polite"
                aria-label={loadingPhaseLabel(matchPhase)}
              >
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                <span className="text-xs font-semibold text-indigo-900">
                  {loadingPhaseLabel(matchPhase)}
                </span>
              </div>
            ) : null}
            {matchResult ? (
              <span
                className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-bold tabular-nums transition-all duration-300 ease-out ${scoreBadgeClasses(matchResult.score)}`}
                title="AI match score"
              >
                {matchResult.score}%
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="seniority-badge mt-3 inline-flex"
          data-seniority={seniorityDataAttribute(seniorityLabel)}
          title={reason}
        >
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            {seniorityDisplay}
            {yearsDisplay ? (
              <span className="ml-2 opacity-80">{yearsDisplay}</span>
            ) : null}
            {reason ? <span className="ml-1">ℹ️</span> : null}
          </span>
        </div>

        {matchResult ? (
          <div
            className="mt-4 overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 shadow-sm ring-1 ring-indigo-100/80"
            role="status"
            aria-label="Match analysis result"
          >
            <div className="border-l-4 border-indigo-500 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Match insight
                </span>
                {matchResult.source === "cache" ? (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                    Saved
                  </span>
                ) : (
                  <span className="rounded-full bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200">
                    AI fresh
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                {matchResult.reason}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAnalyzeMatch}
            disabled={analyzeDisabled}
            className="inline-flex min-h-[2.5rem] min-w-[8.5rem] items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analysisLoading ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
                  aria-hidden
                />
                <span className="truncate">{loadingPhaseLabel(matchPhase)}</span>
              </>
            ) : analyzed ? (
              <span>Analyzed ✓</span>
            ) : (
              <span>Analyze Match</span>
            )}
          </button>
          <button
            type="button"
            onClick={openTips}
            disabled={!matchResult}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Adjust My CV
          </button>
          <button
            type="button"
            onClick={applyClick}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Apply
          </button>
        </div>

        <p className="mt-3 text-xs italic text-slate-400">
          Source: {job.source ?? ""}
        </p>

        {tipsModalOpen && matchResult ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
            role="presentation"
            onClick={closeTips}
          >
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200" />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tips-modal-title"
              className="relative z-10 w-full max-w-md scale-100 transform rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ease-out"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="tips-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                Improve your CV for this role
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {jobTitle} · {job.company ?? "Company"}
              </p>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
                {matchResult.tips.map((tip, i) => (
                  <li key={i} className="leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={closeTips}
                className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  } catch {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        Error showing this job.
      </div>
    );
  }
};
