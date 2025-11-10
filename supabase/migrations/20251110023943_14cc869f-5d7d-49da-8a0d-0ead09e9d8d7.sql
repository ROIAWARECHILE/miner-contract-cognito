-- FASE 1: Nuevas tablas para Ficha Contractual y Riesgos/Obligaciones

-- Tabla 1: contract_summaries (Ficha Contractual)
create table if not exists contract_summaries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  contract_code text not null,
  
  -- Metadata ejecutiva
  version_tag text,
  date_issued date,
  validity_start date,
  validity_end date,
  currency text,
  budget_total numeric,
  reajustabilidad text,
  
  -- Estructura ejecutiva
  milestones jsonb,
  compliance_requirements jsonb,
  parties jsonb,
  
  -- Resumen para dashboard
  summary_md text,
  
  -- Trazabilidad
  provenance jsonb,
  raw_json jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contract_summaries_code on contract_summaries (contract_code);
create index if not exists idx_contract_summaries_contract_id on contract_summaries (contract_id);

create trigger update_contract_summaries_updated_at
  before update on contract_summaries
  for each row execute function update_updated_at_column();

-- Tabla 2: contract_risks (Riesgos)
create table if not exists contract_risks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  contract_code text not null,

  -- Clasificación
  risk_type text not null,
  title text not null,
  description text,
  severity text not null,
  probability text,
  
  -- Estado y seguimiento
  status text default 'open',
  obligation boolean default false,
  assigned_to uuid references profiles(id),
  
  -- Fechas y periodicidad
  deadline date,
  periodicity text,
  
  -- Trazabilidad al documento fuente
  clause_ref text,
  page int,
  source_doc_type text,
  source_version text,
  source_excerpt text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contract_risks_code on contract_risks (contract_code);
create index if not exists idx_contract_risks_contract_id on contract_risks (contract_id);
create index if not exists idx_contract_risks_status on contract_risks (status);
create index if not exists idx_contract_risks_severity on contract_risks (severity);
create index if not exists idx_contract_risks_deadline on contract_risks (deadline) where deadline is not null;

create trigger update_contract_risks_updated_at
  before update on contract_risks
  for each row execute function update_updated_at_column();

-- Tabla 3: contract_obligations (Compliance Tracking)
create table if not exists contract_obligations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  contract_code text not null,
  
  -- Definición de la obligación
  name text not null,
  type text not null,
  periodicity text,
  
  -- Estado actual
  status text default 'pending',
  next_due_date date,
  last_submission date,
  
  -- Relación con riesgo
  related_risk_id uuid references contract_risks(id) on delete set null,
  
  -- Metadata
  notes text,
  responsible_user uuid references profiles(id),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contract_obligations_code on contract_obligations (contract_code);
create index if not exists idx_contract_obligations_status on contract_obligations (status);
create index if not exists idx_contract_obligations_next_due on contract_obligations (next_due_date) where next_due_date is not null;

create trigger update_contract_obligations_updated_at
  before update on contract_obligations
  for each row execute function update_updated_at_column();

-- RLS Policies para contract_summaries
alter table contract_summaries enable row level security;

create policy "Authenticated users can view summaries"
  on contract_summaries for select
  to authenticated using (true);

create policy "Legal and admins can manage summaries"
  on contract_summaries for all
  to authenticated using (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  )
  with check (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  );

-- RLS Policies para contract_risks
alter table contract_risks enable row level security;

create policy "Authenticated users can view risks"
  on contract_risks for select
  to authenticated using (true);

create policy "Legal and admins can manage risks"
  on contract_risks for all
  to authenticated using (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  )
  with check (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  );

-- RLS Policies para contract_obligations
alter table contract_obligations enable row level security;

create policy "Authenticated users can view obligations"
  on contract_obligations for select
  to authenticated using (true);

create policy "Legal and admins can manage obligations"
  on contract_obligations for all
  to authenticated using (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  )
  with check (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role])
  );