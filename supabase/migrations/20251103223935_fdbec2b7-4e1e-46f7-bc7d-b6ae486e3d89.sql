-- Corrección de EDP #2: Añadir tarea 1.2 faltante y periodo
-- Este EDP debe tener la tarea 1.2 "Visita a terreno" con 156.58 UF

-- Actualizar EDP #2 con la tarea 1.2 faltante
UPDATE payment_states
SET 
  data = jsonb_set(
    data,
    '{tasks_executed}',
    COALESCE(data->'tasks_executed', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'task_number', '1.2',
        'name', 'Visita a terreno',
        'budget_uf', 216,
        'spent_uf', 156.58,
        'progress_pct', 73
      )
    )
  ),
  period_label = 'Ago-25',
  amount_uf = amount_uf + 156.58,
  updated_at = NOW()
WHERE 
  edp_number = 2
  AND contract_id IN (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001')
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'tasks_executed') task
    WHERE task->>'task_number' = '1.2'
  );

-- Insertar o actualizar la tarea 1.2 en contract_tasks
INSERT INTO contract_tasks (contract_id, task_number, task_name, budget_uf, spent_uf, progress_percentage)
SELECT 
  id as contract_id,
  '1.2' as task_number,
  'Visita a terreno' as task_name,
  216 as budget_uf,
  156.58 as spent_uf,
  ROUND((156.58 / 216) * 100) as progress_percentage
FROM contracts
WHERE code = 'AIPD-CSI001-1000-MN-0001'
ON CONFLICT (contract_id, task_number) DO UPDATE
SET 
  spent_uf = EXCLUDED.spent_uf,
  progress_percentage = EXCLUDED.progress_percentage,
  updated_at = NOW();