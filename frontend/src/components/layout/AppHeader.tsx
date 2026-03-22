import { type FC } from "react";
import { Link, NavLink } from "react-router-dom";

function HeartNavIcon({ className }: { className?: string }): JSX.Element {
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
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  [
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-slate-100 text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");

export const AppHeader: FC = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-3.5">
        <Link
          to="/"
          className="shrink-0 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <img
            src="/findy-logo.png"
            alt="Findy — AI-Powered Career Matcher"
            width={320}
            height={82}
            className="h-12 w-auto max-w-[min(100%,340px)] object-contain object-left sm:h-16"
            decoding="async"
          />
        </Link>

        <nav
          className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0"
          aria-label="Main"
        >
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/login" className={navLinkClass}>
            Log in
          </NavLink>
          <NavLink to="/liked" className={navLinkClass}>
            <HeartNavIcon className="h-4 w-4 shrink-0" />
            <span>Liked jobs</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};
