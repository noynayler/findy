-- Apply if you already ran an older schema.sql without scraper columns on public.jobs.

alter table public.jobs add column if not exists source text not null default '';
alter table public.jobs add column if not exists date_posted timestamptz null;
alter table public.jobs add column if not exists raw_json jsonb not null default '{}'::jsonb;
alter table public.jobs add column if not exists last_seen_at timestamptz not null default now();

create index if not exists jobs_date_posted_idx on public.jobs (date_posted desc nulls last);
