import { type FC } from "react";

/** Presentational loading placeholder for the job results area. */
export const JobResultsSkeleton: FC = () => (
  <div
    className="mt-8 space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    aria-busy="true"
    aria-label="Loading jobs"
  >
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 animate-pulse rounded-md bg-slate-200" />
      <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
    </div>
    <div className="space-y-3 pt-2">
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
    </div>
  </div>
);
