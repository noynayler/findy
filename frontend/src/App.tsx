import { type ChangeEvent, useCallback, useState, type FC } from "react";
import type { Candidate, Job, JobsSearchRequestBody, SeniorityValue } from "./types";
import { parseJobsSearchResponse, parseResumeUploadResponse } from "./utils/apiGuards";
import { JobList } from "./components/JobList";
import { JobSearchForm } from "./components/JobSearchForm";
import { ResumeSection } from "./components/ResumeSection";
import { insertResumeRecord, upsertJobsCache } from "./services/dbService";

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

export const App: FC = () => {
  const [candidate, setCandidate] = useState<Candidate>(initialCandidate);
  const [resumeStatusText, setResumeStatusText] = useState<string>("");
  const [resumeStatusKind, setResumeStatusKind] = useState<"neutral" | "success" | "error">(
    "neutral",
  );

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
    const formData = new FormData();
    formData.append("resume", file);
    setResumeStatusText("Uploading...");
    setResumeStatusKind("neutral");
    try {
      const response = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const raw: unknown = await response.json();
      const data = parseResumeUploadResponse(raw);
      if (data.success) {
        const resumeId = await insertResumeRecord(data.resume_text, file.name);
        setCandidate({
          resumeText: data.resume_text,
          textLength: data.text_length,
          resumeId,
        });
        setResumeStatusText(
          `✓ Resume uploaded (${data.text_length} chars)${resumeId ? "" : " (not saved to cloud)"}`,
        );
        setResumeStatusKind("success");
      } else {
        setCandidate(initialCandidate);
        setResumeStatusText(`Error: ${data.error}`);
        setResumeStatusKind("error");
      }
    } catch (err) {
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
      setLoading(false);
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
    }
  }, [seniority, title]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 py-8 px-4 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-10">
        <header className="mb-10 border-b border-slate-100 pb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            🔍 Findy
          </h1>
          <p className="mt-2 text-slate-600">
            Find tech jobs in Israel — last 7 days · AI match with Gemini
          </p>
        </header>

        <ResumeSection
          statusText={resumeStatusText}
          statusClassName={resumeStatusClass(resumeStatusKind)}
          onUploadResume={handleUploadResume}
        />

        <JobSearchForm
          title={title}
          seniority={seniority}
          onTitleChange={handleTitleChange}
          onSeniorityChange={handleSeniorityChange}
          onSearch={handleSearch}
        />

        <div
          className={
            loading
              ? "mb-6 rounded-xl bg-indigo-50 py-4 text-center text-sm font-medium text-indigo-800"
              : "hidden"
          }
        >
          Loading jobs…
        </div>
        <div
          className={
            errorMessage
              ? "mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              : "hidden"
          }
        >
          {errorMessage}
        </div>

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
      </div>
    </div>
  );
};
