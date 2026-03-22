import { type FC } from "react";
import { Card } from "../components/ui/Card";

function HeartLargeIcon({ className }: { className?: string }): JSX.Element {
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
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

export const LikedJobsPage: FC = () => {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Card className="p-8 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <HeartLargeIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Liked jobs
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
          Saved roles will appear here once we add favorites. For now, open listings from the home
          search and use <span className="font-medium text-slate-700">Apply</span> to visit the job
          page.
        </p>
      </Card>
    </main>
  );
};
