import { type ChangeEvent, type FC, type FormEvent } from "react";
import type { SeniorityValue } from "../types";
import { Button } from "./ui/Button";

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

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-slate-200/90 bg-slate-50/60 p-5 sm:p-6"
    >
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">
          Job title <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={onTitleChange}
          placeholder="e.g. DevOps, backend, frontend"
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="seniority"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Seniority
        </label>
        <select
          id="seniority"
          name="seniority"
          value={seniority}
          onChange={onSeniorityChange}
          className={`${inputClass} cursor-pointer`}
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
      <Button type="submit" variant="primary" className="w-full min-h-11 sm:w-auto sm:min-w-[10rem]">
        Search jobs
      </Button>
    </form>
  );
};
