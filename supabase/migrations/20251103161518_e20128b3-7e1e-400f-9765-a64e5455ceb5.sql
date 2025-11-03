-- Fase 1: Crear vista view_contract_overview para calcular métricas
CREATE OR REPLACE VIEW view_contract_overview AS
SELECT 
  c.id AS contract_id,
  c.code,
  c.title,
  -- Extraer budget_uf del metadata JSONB
  COALESCE((c.metadata->>'budget_uf')::numeric, c.contract_value, 0) AS budget_uf,
  -- Calcular spent_uf desde payment_states
  COALESCE(SUM(ps.amount_uf), 0) AS spent_uf,
  -- Calcular available_uf
  COALESCE((c.metadata->>'budget_uf')::numeric, c.contract_value, 0) - COALESCE(SUM(ps.amount_uf), 0) AS available_uf,
  -- Calcular progress_pct
  CASE 
    WHEN COALESCE((c.metadata->>'budget_uf')::numeric, c.contract_value, 0) > 0 THEN
      (COALESCE(SUM(ps.amount_uf), 0) / COALESCE((c.metadata->>'budget_uf')::numeric, c.contract_value, 0) * 100)
    ELSE 0
  END AS progress_pct,
  -- Contar EDPs pagados/aprobados
  COUNT(ps.id) FILTER (WHERE ps.status IN ('approved', 'paid')) AS edps_paid
FROM contracts c
LEFT JOIN payment_states ps ON ps.contract_id = c.id AND ps.status IN ('approved', 'paid')
GROUP BY c.id, c.code, c.title, c.metadata, c.contract_value;

-- Fase 4: Poblar datos de prueba para el contrato Dominga
-- 4.1: Actualizar contrato con metadata correcto
UPDATE contracts 
SET 
  metadata = jsonb_build_object(
    'budget_uf', 4501,
    'client', 'Andes Iron SpA',
    'contractor', 'Itasca Chile SpA',
    'overall_progress_pct', 5
  ),
  start_date = '2025-07-21',
  title = 'Contrato Proforma Hidrología-Hidrogeología',
  contract_value = 4501
WHERE code = 'AIPD-CSI001-1000-MN-0001';

-- 4.2: Crear las 10 tareas esperadas (usar UPSERT por si ya existen)
INSERT INTO contract_tasks (contract_id, task_number, task_name, budget_uf, spent_uf, progress_percentage)
SELECT 
  (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001'),
  task_number,
  task_name,
  budget_uf,
  spent_uf,
  progress_pct
FROM (VALUES
  ('1.1', 'Recopilación y análisis de información', 507, 147.85, 29),
  ('2.0', 'Levantamiento topográfico', 216, 0, 0),
  ('3.1', 'Actualización del estudio hidrológico', 863, 50.31, 6),
  ('4.0', 'Modelo hidrogeológico conceptual', 256, 0, 0),
  ('5.0', 'Modelo hidrogeológico numérico', 843, 0, 0),
  ('6.0', 'Análisis de sensibilidad', 213, 0, 0),
  ('7.0', 'Informe técnico', 423, 0, 0),
  ('8.0', 'Revisión y ajustes', 580, 0, 0),
  ('9.0', 'Reuniones y presentaciones', 386, 11.66, 3),
  ('10.0', 'Gestión del proyecto', 214, 0, 0)
) AS t(task_number, task_name, budget_uf, spent_uf, progress_pct)
ON CONFLICT (contract_id, task_number) DO UPDATE
SET 
  task_name = EXCLUDED.task_name,
  budget_uf = EXCLUDED.budget_uf,
  spent_uf = EXCLUDED.spent_uf,
  progress_percentage = EXCLUDED.progress_percentage;

-- 4.3: Crear EDP #1 en payment_states (usar UPSERT)
INSERT INTO payment_states (contract_id, edp_number, period_start, period_end, amount_uf, status, uf_rate, amount_clp, period_label, data)
VALUES (
  (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001'),
  1,
  '2025-07-01',
  '2025-07-31',
  209.81,
  'approved',
  39179.01,
  8219991,
  'Jul-25',
  jsonb_build_object(
    'tasks_executed', jsonb_build_array(
      jsonb_build_object('task_number', '1.1', 'name', 'Recopilación y análisis de información', 'spent_uf', 147.85, 'progress_pct', 29),
      jsonb_build_object('task_number', '3.1', 'name', 'Actualización del estudio hidrológico', 'spent_uf', 50.31, 'progress_pct', 6),
      jsonb_build_object('task_number', '9.0', 'name', 'Reuniones y presentaciones', 'spent_uf', 11.66, 'progress_pct', 3)
    )
  )
)
ON CONFLICT (contract_id, edp_number) DO UPDATE
SET 
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  amount_uf = EXCLUDED.amount_uf,
  status = EXCLUDED.status,
  uf_rate = EXCLUDED.uf_rate,
  amount_clp = EXCLUDED.amount_clp,
  period_label = EXCLUDED.period_label,
  data = EXCLUDED.data;