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
import { Button } from "./ui/Button";

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

function PinIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5"
      />
    </svg>
  );
}

function MatchScoreBadge({ score }: { score: number }): JSX.Element {
  const tier =
    score >= 80
      ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
      : score >= 50
        ? "border-amber-200/90 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-100 text-slate-800";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums shadow-sm ${tier}`}
      aria-label={`Match score ${score} percent`}
    >
      {score}%
      <span className="ml-1 text-xs font-medium opacity-75">match</span>
    </span>
  );
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
          jobUrl: job.url ?? null,
          jobSnapshot: {
            title: job.title,
            company: job.company,
            location: job.location,
            source: job.source,
            description: job.description,
            url: job.url,
          },
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
    job.url,
    job.title,
    job.company,
    job.location,
    job.source,
    job.description,
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
    const analyzeDisabled = analysisLoading || analyzed || !hasResume;

    return (
      <article className="group relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-card transition-all duration-200 hover:border-slate-300 hover:shadow-card-hover sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl">
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-slate-700 hover:underline decoration-slate-300 underline-offset-2"
                  >
                    {jobTitle}
                  </a>
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {job.company ?? "—"}
                </p>
              </div>
              {matchResult ? <MatchScoreBadge score={matchResult.score} /> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {!hasApiKey && hasResume ? (
              <span
                className="max-w-[14rem] rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200"
                title="Set VITE_GEMINI_API_KEY for first-time analysis (saved matches load without it)"
              >
                Gemini key needed for new matches
              </span>
            ) : null}
            {!hasResume ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                Upload CV to analyze match
              </span>
            ) : null}
            {analysisError && !analyzed ? (
              <span
                className="max-w-[14rem] rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] text-rose-800"
                title={analysisError}
              >
                {analysisError.length > 48
                  ? `${analysisError.slice(0, 48)}…`
                  : analysisError}
              </span>
            ) : null}
            {analysisLoading ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                aria-busy="true"
                aria-live="polite"
              >
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                <span className="text-xs font-medium text-slate-600">
                  {loadingPhaseLabel(matchPhase)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon className="h-4 w-4 shrink-0 text-slate-400" />
            {job.location ?? "Location not specified"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            {dateDisplay}
          </span>
          <div
            className="seniority-badge inline-flex"
            data-seniority={seniorityDataAttribute(seniorityLabel)}
            title={reason}
          >
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              {seniorityDisplay}
              {yearsDisplay ? (
                <span className="ml-1.5 opacity-90">{yearsDisplay}</span>
              ) : null}
              {reason ? (
                <span className="ml-1 text-slate-400" title={reason}>
                  ℹ️
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {matchResult ? (
          <div
            className="mt-5 rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-4"
            role="status"
            aria-label="Match analysis result"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Match insight
              </span>
              {matchResult.source === "cache" ? (
                <span className="rounded-md bg-slate-200/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  Saved
                </span>
              ) : (
                <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  AI fresh
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {matchResult.reason}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 sm:gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={handleAnalyzeMatch}
            disabled={analyzeDisabled}
            className="min-h-10 min-w-[8.5rem]"
          >
            {analysisLoading ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800"
                  aria-hidden
                />
                <span className="truncate">{loadingPhaseLabel(matchPhase)}</span>
              </>
            ) : analyzed ? (
              <span>Analyzed ✓</span>
            ) : (
              <span>Analyze match</span>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openTips}
            disabled={!matchResult}
            className="min-h-10 min-w-[8.5rem]"
          >
            Adjust my CV
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={applyClick}
            className="min-h-10 min-w-[5.5rem]"
          >
            Apply
          </Button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Source:{" "}
          <span className="cursor-default underline decoration-slate-400 underline-offset-2">
            {job.source ?? "—"}
          </span>
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
              className="relative z-10 w-full max-w-md scale-100 transform rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xl transition-transform duration-200 ease-out"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src="/findy-logo.png"
                alt=""
                width={320}
                height={82}
                className="mx-auto mb-5 h-auto w-full max-w-[min(100%,300px)] object-contain opacity-95 sm:max-w-[340px]"
                decoding="async"
                aria-hidden
              />
              <h2
                id="tips-modal-title"
                className="text-lg font-semibold tracking-tight text-slate-900"
              >
                Improve your CV for this role
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {jobTitle} · {job.company ?? "Company"}
              </p>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
                {matchResult.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ol>
              <Button
                type="button"
                variant="primary"
                onClick={closeTips}
                className="mt-6 w-full min-h-11"
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    );
  } catch {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/90 p-6 text-sm text-red-800 shadow-card">
        Error showing this job.
      </div>
    );
  }
};
