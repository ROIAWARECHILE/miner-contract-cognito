-- Create ingest_jobs table
create table if not exists ingest_jobs(
  id uuid primary key default gen_random_uuid(),
  project_prefix text not null,
  storage_path text not null,
  file_hash text,
  etag text,
  status text default 'queued',
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create unique index for idempotency
create unique index if not exists idx_ingest_jobs_unique 
on ingest_jobs (project_prefix, storage_path, coalesce(file_hash,''), coalesce(etag,''));

-- Create ingest_logs table
create table if not exists ingest_logs(
  id bigserial primary key,
  job_id uuid references ingest_jobs(id) on delete cascade,
  step text,
  message text,
  meta jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table ingest_jobs enable row level security;
alter table ingest_logs enable row level security;

-- RLS policies for ingest tables
drop policy if exists "auth_read_ingest_jobs" on ingest_jobs;
create policy "auth_read_ingest_jobs" on ingest_jobs
for select to authenticated using (true);

drop policy if exists "auth_write_ingest_jobs" on ingest_jobs;
create policy "auth_write_ingest_jobs" on ingest_jobs
for all to authenticated using (true);

drop policy if exists "auth_read_ingest_logs" on ingest_logs;
create policy "auth_read_ingest_logs" on ingest_logs
for select to authenticated using (true);

-- Storage bucket (contracts)
insert into storage.buckets (id, name, public)
values ('contracts','contracts', false)
on conflict (id) do nothing;

-- Storage RLS policies
drop policy if exists "auth_read_contracts" on storage.objects;
drop policy if exists "auth_write_contracts" on storage.objects;
drop policy if exists "auth_update_contracts" on storage.objects;
drop policy if exists "auth_delete_contracts" on storage.objects;

create policy "auth_read_contracts" on storage.objects
for select to authenticated using (bucket_id = 'contracts');

create policy "auth_write_contracts" on storage.objects
for insert to authenticated with check (bucket_id = 'contracts');

create policy "auth_update_contracts" on storage.objects
for update to authenticated using (bucket_id = 'contracts');

create policy "auth_delete_contracts" on storage.objects
for delete to authenticated using (bucket_id = 'contracts');

-- RPC function for job queue
create or replace function get_next_ingest_job()
returns ingest_jobs language plpgsql as $$
declare
  j ingest_jobs;
begin
  select * into j from ingest_jobs
  where status = 'queued'
  order by created_at asc
  for update skip locked
  limit 1;
  return j;
end;
$$;