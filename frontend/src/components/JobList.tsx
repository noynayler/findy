import { type FC } from "react";
import type { Job } from "../types";
import { JobCard } from "./JobCard";

export interface JobListProps {
  jobs: Job[];
  resumeText: string | null;
  resumeId: string | null;
  titleFilter: string;
  seniorityFilter: string;
  totalCount: number | null;
  filtered: boolean;
  showTotalJobsSection: boolean;
}

function buildFilterNote(
  jobCount: number,
  totalCount: number | null,
  filtered: boolean,
  titleFilter: string,
  seniorityFilter: string,
): string {
  if (filtered && totalCount !== null) {
    const parts: string[] = [];
    if (titleFilter) parts.push(`role: "${titleFilter}"`);
    if (seniorityFilter) parts.push(`seniority: ${seniorityFilter}`);
    return `Showing ${jobCount} of ${totalCount} total jobs (filtered by ${parts.join(", ")})`;
  }
  if (totalCount !== null) {
    return `Showing all ${totalCount} jobs from the last 7 days`;
  }
  return "";
}

export const JobList: FC<JobListProps> = ({
  jobs,
  resumeText,
  resumeId,
  titleFilter,
  seniorityFilter,
  totalCount,
  filtered,
  showTotalJobsSection,
}) => {
  const filterNote = buildFilterNote(
    jobs.length,
    totalCount,
    filtered,
    titleFilter,
    seniorityFilter,
  );

  return (
    <>
      <div
        id="totalJobsSection"
        className={
          showTotalJobsSection
            ? "mb-6 rounded-xl border border-blue-100 bg-blue-50/80 p-5 shadow-sm"
            : "hidden"
        }
      >
        <h2 className="text-lg font-semibold text-blue-900">
          Total Jobs Available:{" "}
          <span className="tabular-nums text-blue-700">{totalCount ?? 0}</span>
        </h2>
        {filterNote ? (
          <p className="mt-2 text-sm text-slate-600">{filterNote}</p>
        ) : null}
      </div>
      <div className="mt-2">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          Results: <span className="text-indigo-600">{jobs.length}</span> jobs
        </h2>
        <div className="grid gap-4">
          {jobs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
              No jobs found. Try adjusting your filters.
            </p>
          ) : (
            jobs.map((job, index) => (
              <JobCard
                key={`${job.url ?? job.title ?? "job"}-${index}`}
                job={job}
                resumeText={resumeText}
                resumeId={resumeId}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};
