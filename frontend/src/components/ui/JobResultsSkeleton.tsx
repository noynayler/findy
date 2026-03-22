import { type FC } from "react";

/** Presentational loading placeholder for the job results area. */
export const JobResultsSkeleton: FC = () => (
  <div
    className="mt-8 space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    aria-busy="true"
    aria-live="polite"
    aria-label="Loading jobs"
  >
    <div className="flex items-center gap-3 text-slate-700">
      <div
        className="h-8 w-8 shrink-0 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-700"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-800">Loading jobs…</p>
    </div>
    <div className="space-y-3 pt-2">
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
    </div>
  </div>
);
