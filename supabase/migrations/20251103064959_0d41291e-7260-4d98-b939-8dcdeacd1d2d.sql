-- Insert sample company
INSERT INTO public.companies (id, name, country, contact_email, rating, notes)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Minera Los Andes S.A.', 'Chile', 'contacto@mineralosandes.cl', 'A', 'Empresa de minería de cobre con presencia en la Región de Valparaíso')
ON CONFLICT (id) DO NOTHING;

-- Insert sample asset
INSERT INTO public.assets (id, name, type, status, country, region, project, coordinates)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'Mina El Teniente', 'mine', 'active', 'Chile', 'Región de O''Higgins', 'Extracción de Cobre', '-34.0856,-70.3703')
ON CONFLICT (id) DO NOTHING;

-- Insert sample contracts
INSERT INTO public.contracts (
  id, code, title, type, status, start_date, end_date, 
  contract_value, currency, country, mineral, 
  company_id, asset_id, summary_ai
)
VALUES 
  (
    '33333333-3333-3333-3333-333333333333',
    'CT-2024-001',
    'Contrato de Concesión Minera - Fase 1',
    'concession',
    'active',
    '2024-01-15',
    '2026-12-31',
    5500000,
    'USD',
    'Chile',
    'Cobre',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'Contrato principal para concesión de explotación de mineral de cobre en Mina El Teniente durante 3 años.'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'CT-2024-002',
    'Contrato de Transporte y Logística Minera',
    'logistics',
    'active',
    '2024-03-01',
    '2025-02-28',
    850000,
    'USD',
    'Chile',
    'Cobre',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'Servicio de transporte de mineral desde mina hasta puerto de embarque.'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample obligations
INSERT INTO public.obligations (
  contract_id, type, description, status, criticality, due_date
)
VALUES 
  (
    '33333333-3333-3333-3333-333333333333',
    'compliance',
    'Presentar informe mensual de producción',
    'pending',
    'high',
    '2024-12-31'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'reporting',
    'Reporte de impacto ambiental Q4 2024',
    'in_progress',
    'medium',
    '2024-12-15'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'compliance',
    'Certificación de vehículos de transporte',
    'completed',
    'high',
    '2024-11-01'
  )
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO public.alerts (
  entity_type, entity_id, title, alert_date, priority, status
)
VALUES 
  (
    'contract',
    '33333333-3333-3333-3333-333333333333',
    'Vencimiento próximo de informe mensual',
    '2024-12-25',
    'high',
    'new'
  ),
  (
    'contract',
    '44444444-4444-4444-4444-444444444444',
    'Renovación de seguro de transporte',
    '2025-01-15',
    'medium',
    'new'
  )
ON CONFLICT DO NOTHING;