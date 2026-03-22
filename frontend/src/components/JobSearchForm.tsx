import { type ChangeEvent, type FC, type FormEvent } from "react";
import type { SeniorityValue } from "../types";

export interface JobSearchFormProps {
  title: string;
  seniority: SeniorityValue;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSeniorityChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSearch: () => void;
}

export const JobSearchForm: FC<JobSearchFormProps> = ({
  title,
  seniority,
  onTitleChange,
  onSeniorityChange,
  onSearch,
}) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSearch();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-700">
          Job Title (optional)
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={onTitleChange}
          placeholder="e.g., devops, backend, frontend"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>
      <div>
        <label
          htmlFor="seniority"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Seniority Level
        </label>
        <select
          id="seniority"
          name="seniority"
          value={seniority}
          onChange={onSeniorityChange}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Any</option>
          <option value="intern">Intern</option>
          <option value="entry-level">Entry Level</option>
          <option value="junior">Junior</option>
          <option value="mid">Mid-Level</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <button
        type="submit"
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-md transition hover:from-indigo-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto sm:px-8"
      >
        Search Jobs
      </button>
    </form>
  );
};
