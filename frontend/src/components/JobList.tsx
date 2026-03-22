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

function EmptyStateIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.25}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.108-.806-2.057-1.907-2.185a48.507 48.507 0 0 0-6.135-.449m9.092 4.396a2.125 2.125 0 0 0-1.91-1.91H15.75M20.25 14.15h-16.5"
      />
    </svg>
  );
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
            ? "mt-10 rounded-xl border border-slate-200/90 bg-white p-5 shadow-card sm:p-6"
            : "hidden"
        }
      >
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {totalCount ?? 0}{" "}
          <span className="text-base font-normal text-slate-500">jobs</span>
        </p>
        {filterNote ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{filterNote}</p>
        ) : null}
      </div>

      <section className="mt-10" aria-labelledby="job-results-heading">
        <div className="mb-6 border-b border-slate-200/80 pb-6">
          <h2
            id="job-results-heading"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Results
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700 tabular-nums">{jobs.length}</span>{" "}
            {jobs.length === 1 ? "position" : "positions"} listed
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <EmptyStateIcon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base font-medium text-slate-900">No jobs found</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Try broadening your search, clearing filters, or running a new search to refresh listings.
              </p>
            </div>
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
      </section>
    </>
  );
};
