-- Apply if you already ran an older schema without `tips` / unique pair.
-- Safe to run once.

alter table public.match_history
  add column if not exists tips jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'match_history_resume_job_unique'
  ) then
    delete from public.match_history a
    using public.match_history b
    where a.resume_id = b.resume_id
      and a.job_id = b.job_id
      and a.created_at < b.created_at;
    alter table public.match_history
      add constraint match_history_resume_job_unique unique (resume_id, job_id);
  end if;
end $$;

drop policy if exists "match_history_update_anon" on public.match_history;
create policy "match_history_update_anon" on public.match_history for update using (true) with check (true);
