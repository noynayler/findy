-- Run against your PostgreSQL instance (psql, GUI, or on app startup).
-- Findy: resumes, jobs cache (scraper + UI), AI match history.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- resumes: parsed CV text from upload
-- ---------------------------------------------------------------------------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs: cached job postings (unique URL = dedupe)
-- Flask scraper stores raw_json + source + date_posted; UI upserts by url.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  company text not null default '',
  description text not null default '',
  url text not null,
  location text not null default '',
  source text not null default '',
  date_posted timestamptz null,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint jobs_url_key unique (url)
);

create index if not exists jobs_url_idx on public.jobs (url);
create index if not exists jobs_date_posted_idx on public.jobs (date_posted desc nulls last);

-- ---------------------------------------------------------------------------
-- match_history: Gemini analysis per resume + job (one row per pair)
-- ---------------------------------------------------------------------------
create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  score integer not null,
  ai_reason text not null,
  tips jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint match_history_resume_job_unique unique (resume_id, job_id)
);

create index if not exists match_history_resume_idx on public.match_history (resume_id);
create index if not exists match_history_job_idx on public.match_history (job_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (tighten policies in production)
-- ---------------------------------------------------------------------------
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
alter table public.match_history enable row level security;

drop policy if exists "resumes_select_anon" on public.resumes;
create policy "resumes_select_anon" on public.resumes for select using (true);
drop policy if exists "resumes_insert_anon" on public.resumes;
create policy "resumes_insert_anon" on public.resumes for insert with check (true);

drop policy if exists "jobs_select_anon" on public.jobs;
create policy "jobs_select_anon" on public.jobs for select using (true);
drop policy if exists "jobs_insert_anon" on public.jobs;
create policy "jobs_insert_anon" on public.jobs for insert with check (true);
drop policy if exists "jobs_update_anon" on public.jobs;
create policy "jobs_update_anon" on public.jobs for update using (true) with check (true);

drop policy if exists "match_history_select_anon" on public.match_history;
create policy "match_history_select_anon" on public.match_history for select using (true);
drop policy if exists "match_history_insert_anon" on public.match_history;
create policy "match_history_insert_anon" on public.match_history for insert with check (true);
drop policy if exists "match_history_update_anon" on public.match_history;
create policy "match_history_update_anon" on public.match_history for update using (true) with check (true);
