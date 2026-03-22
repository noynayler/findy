import {
  type ChangeEvent,
  useCallback,
  useRef,
  useState,
  type FC,
} from "react";
import type { Candidate, Job, JobsSearchRequestBody, SeniorityValue } from "../types";
import { parseJobsSearchResponse, parseResumeUploadResponse } from "../utils/apiGuards";
import { JobList } from "../components/JobList";
import { JobSearchForm } from "../components/JobSearchForm";
import { ResumeSection } from "../components/ResumeSection";
import { Card } from "../components/ui/Card";
import { JobResultsSkeleton } from "../components/ui/JobResultsSkeleton";
import { insertResumeRecord, upsertJobsCache } from "../services/dbService";

const initialCandidate: Candidate = {
  resumeText: null,
  textLength: null,
  resumeId: null,
};

const resumeStatusClass = (kind: "neutral" | "success" | "error"): string => {
  if (kind === "success") return "text-emerald-600 font-medium";
  if (kind === "error") return "text-red-600 font-medium";
  return "text-slate-600";
};

/** Parse body as JSON; avoids throw on HTML error pages. */
async function responseBodyAsJson(response: Response): Promise<unknown> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      response.ok ? "Empty response from server" : `Server error (HTTP ${response.status})`,
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      response.ok
        ? "Server returned invalid JSON"
        : `Server error (HTTP ${response.status})`,
    );
  }
}

export const HomePage: FC = () => {
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [resumeStatusText, setResumeStatusText] = useState<string>("");
  const [resumeStatusKind, setResumeStatusKind] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  /** Incremented on each upload start; stale async completions must not overwrite UI. */
  const resumeUploadGenRef = useRef(0);
  const resumeUploadAbortRef = useRef<AbortController | null>(null);

  const [title, setTitle] = useState<string>("");
  const [seniority, setSeniority] = useState<SeniorityValue>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filtered, setFiltered] = useState<boolean>(false);
  const [showTotalJobsSection, setShowTotalJobsSection] = useState<boolean>(false);

  const [lastTitleFilter, setLastTitleFilter] = useState<string>("");
  const [lastSeniorityFilter, setLastSeniorityFilter] = useState<string>("");

  const handleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setTitle(event.target.value);
  }, []);

  const handleSeniorityChange = useCallback((event: ChangeEvent<HTMLSelectElement>): void => {
    setSeniority(event.target.value as SeniorityValue);
  }, []);

  const handleUploadResume = useCallback(async (file: File | null): Promise<void> => {
    if (!file) {
      setResumeStatusText("Please select a file");
      setResumeStatusKind("error");
      return;
    }

    resumeUploadAbortRef.current?.abort();
    const ac = new AbortController();
    resumeUploadAbortRef.current = ac;
    const gen = ++resumeUploadGenRef.current;

    const isStale = (): boolean => gen !== resumeUploadGenRef.current;

    const formData = new FormData();
    formData.append("resume", file);
    setResumeStatusText("Uploading…");
    setResumeStatusKind("neutral");

    try {
      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
        signal: ac.signal,
      });

      if (isStale()) {
        return;
      }

      const raw: unknown = await responseBodyAsJson(response);

      if (isStale()) {
        return;
      }

      const data = parseResumeUploadResponse(raw);

      if (!response.ok || !data.success) {
        setCandidate(initialCandidate);
        const msg =
          !data.success && "error" in data
            ? data.error
            : `Request failed (HTTP ${response.status})`;
        setResumeStatusText(`Error: ${msg}`);
        setResumeStatusKind("error");
        return;
      }

      setResumeStatusText("Saving to cloud…");
      const resumeId = await insertResumeRecord(data.resume_text, file.name);

      if (isStale()) {
        return;
      }

      setCandidate({
        resumeText: data.resume_text,
        textLength: data.text_length,
        resumeId,
      });
      setResumeStatusText(
        `✓ Resume uploaded (${data.text_length} chars)${resumeId ? "" : " (not saved to cloud)"}`,
      );
      setResumeStatusKind("success");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (isStale()) {
        return;
      }
      const message = err instanceof Error ? err.message : "Upload failed";
      setCandidate(initialCandidate);
      setResumeStatusText(`Error: ${message}`);
      setResumeStatusKind("error");
    }
  }, []);

  const handleSearch = useCallback(async (): Promise<void> => {
    const titleTrimmed = title.trim();
    setLoading(true);
    setErrorMessage("");
    setJobs([]);

    const body: JobsSearchRequestBody = { days: 7 };
    if (titleTrimmed) body.title = titleTrimmed;
    if (seniority) body.seniority = seniority;
    // CV ↔ job matching is done client-side with Gemini (see JobCard); omit resume_text here
    // to avoid slow server-side keyword ranking.

    const timeoutMs = 300_000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errRaw: unknown = await response.json();
          if (
            typeof errRaw === "object" &&
            errRaw !== null &&
            "error" in errRaw &&
            typeof (errRaw as { error: unknown }).error === "string"
          ) {
            errorMsg = (errRaw as { error: string }).error;
          }
        } catch {
          const text = await response.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      const raw: unknown = await response.json();
      const data = parseJobsSearchResponse(raw);
      setLoading(false);

      if (data.success) {
        if (data.total_count !== undefined) {
          setTotalCount(data.total_count);
          setShowTotalJobsSection(true);
        }
        setFiltered(Boolean(data.filtered));
        setLastTitleFilter(titleTrimmed);
        setLastSeniorityFilter(seniority);
        const urlToId = await upsertJobsCache(data.jobs);
        const merged: Job[] = data.jobs.map((j) => {
          const u = j.url;
          if (u && urlToId[u]) {
            return { ...j, supabase_job_id: urlToId[u] };
          }
          return j;
        });
        setJobs(merged);
      } else {
        setErrorMessage(data.error || "Failed to fetch jobs");
      }
    } catch (err) {
      window.clearTimeout(timeoutId);
      let errorMsg: string;
      if (err instanceof Error && err.name === "AbortError") {
        errorMsg = "Request timed out. Try again or use fewer filters.";
      } else if (
        err instanceof Error &&
        (err.message === "Failed to fetch" || err.message === "Load failed")
      ) {
        errorMsg =
          "Cannot reach the server. Open http://localhost:5000 and run: python run.py";
      } else {
        errorMsg = err instanceof Error ? err.message : "Something went wrong.";
      }
      setErrorMessage(`Error: ${errorMsg}`);
      setLoading(false);
    }
  }, [seniority, title]);

  return (
    <>
      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-8 text-center sm:pb-12 sm:pt-10">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl sm:leading-tight">
            Know your match before you apply
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            AI-powered analysis of Israel tech jobs with personalized CV insights and fit scoring.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <Card className="p-6 sm:p-8">
          <JobSearchForm
            title={title}
            seniority={seniority}
            onTitleChange={handleTitleChange}
            onSeniorityChange={handleSeniorityChange}
            onSearch={handleSearch}
          />

          <div className="my-8 border-t border-slate-100" aria-hidden />

          <ResumeSection
            statusText={resumeStatusText}
            statusClassName={resumeStatusClass(resumeStatusKind)}
            onUploadResume={handleUploadResume}
          />
        </Card>

        <div className={loading ? "mt-8" : "hidden"}>
          <JobResultsSkeleton />
        </div>

        <div
          className={
            errorMessage
              ? "mt-8 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-900 shadow-sm"
              : "hidden"
          }
          role="alert"
        >
          {errorMessage}
        </div>

        {!loading ? (
          <JobList
            jobs={jobs}
            resumeText={candidate.resumeText}
            resumeId={candidate.resumeId}
            titleFilter={lastTitleFilter}
            seniorityFilter={lastSeniorityFilter}
            totalCount={totalCount}
            filtered={filtered}
            showTotalJobsSection={showTotalJobsSection}
          />
        ) : null}
      </main>
    </>
  );
};
