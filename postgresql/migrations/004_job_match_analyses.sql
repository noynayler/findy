-- Analyzed job matches keyed by CV content hash + job URL (no dependency on public.jobs).
-- Used when search no longer persists raw listings to Supabase.

create table if not exists public.job_match_analyses (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid null references public.resumes (id) on delete set null,
  cv_content_hash text not null,
  job_url text not null,
  job_snapshot jsonb not null default '{}'::jsonb,
  score integer not null,
  ai_reason text not null,
  tips jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_match_analyses_cv_url_key unique (cv_content_hash, job_url)
);

create index if not exists job_match_analyses_cv_hash_idx on public.job_match_analyses (cv_content_hash);
create index if not exists job_match_analyses_job_url_idx on public.job_match_analyses (job_url);

alter table public.job_match_analyses enable row level security;

drop policy if exists "job_match_analyses_select_anon" on public.job_match_analyses;
create policy "job_match_analyses_select_anon" on public.job_match_analyses for select using (true);
drop policy if exists "job_match_analyses_insert_anon" on public.job_match_analyses;
create policy "job_match_analyses_insert_anon" on public.job_match_analyses for insert with check (true);
drop policy if exists "job_match_analyses_update_anon" on public.job_match_analyses;
create policy "job_match_analyses_update_anon" on public.job_match_analyses for update using (true) with check (true);
