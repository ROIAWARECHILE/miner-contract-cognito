-- Corregir interpretación errónea de task_numbers en payment_states y contract_tasks

-- PASO 1: Corregir task_numbers en payment_states
UPDATE payment_states
SET data = jsonb_set(
  data,
  '{tasks_executed}',
  (
    SELECT jsonb_agg(
      CASE 
        -- Corregir "1.1" → "1" (Recopilación y análisis)
        WHEN (task->>'task_number') = '1.1' AND (task->>'name') LIKE '%Recopilación y análisis%' THEN
          jsonb_set(task, '{task_number}', '"1"')
        
        -- Corregir "3.1" → "2" (Actualización del estudio hidrológico)
        WHEN (task->>'task_number') = '3.1' THEN
          jsonb_set(task, '{task_number}', '"2"')
        
        -- Normalizar "2.0" → "2"
        WHEN (task->>'task_number') = '2.0' THEN
          jsonb_set(task, '{task_number}', '"2"')
        
        -- Normalizar "3.0" → "3"
        WHEN (task->>'task_number') = '3.0' THEN
          jsonb_set(task, '{task_number}', '"3"')
        
        -- Normalizar "4.0" → "4"
        WHEN (task->>'task_number') = '4.0' THEN
          jsonb_set(task, '{task_number}', '"4"')
        
        -- Normalizar "5.0" → "5"
        WHEN (task->>'task_number') = '5.0' THEN
          jsonb_set(task, '{task_number}', '"5"')
        
        -- Normalizar "6.0" → "6"
        WHEN (task->>'task_number') = '6.0' THEN
          jsonb_set(task, '{task_number}', '"6"')
        
        -- Normalizar "7.0" → "7"
        WHEN (task->>'task_number') = '7.0' THEN
          jsonb_set(task, '{task_number}', '"7"')
        
        -- Normalizar "8.0" → "8"
        WHEN (task->>'task_number') = '8.0' THEN
          jsonb_set(task, '{task_number}', '"8"')
        
        -- Normalizar "9.0" → "9"
        WHEN (task->>'task_number') = '9.0' THEN
          jsonb_set(task, '{task_number}', '"9"')
        
        ELSE task
      END
    )
    FROM jsonb_array_elements(data->'tasks_executed') task
  )
)
WHERE contract_id IN (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001')
AND data->'tasks_executed' IS NOT NULL;

-- PASO 2: Limpiar contract_tasks
DELETE FROM contract_tasks 
WHERE contract_id IN (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001');

-- PASO 3: Recalcular con los task_numbers corregidos
INSERT INTO contract_tasks (contract_id, task_number, task_name, budget_uf, spent_uf, progress_percentage)
SELECT 
  ps.contract_id,
  task_data->>'task_number' as task_number,
  MAX(task_data->>'name') as task_name,
  MAX((task_data->>'budget_uf')::numeric) as budget_uf,
  SUM((task_data->>'spent_uf')::numeric) as spent_uf,
  CASE 
    WHEN MAX((task_data->>'budget_uf')::numeric) > 0 THEN
      ROUND((SUM((task_data->>'spent_uf')::numeric) / MAX((task_data->>'budget_uf')::numeric)) * 100)
    ELSE 0
  END as progress_percentage
FROM payment_states ps,
jsonb_array_elements(ps.data->'tasks_executed') task_data
WHERE ps.contract_id IN (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001')
  AND ps.status IN ('approved', 'submitted')
GROUP BY ps.contract_id, task_data->>'task_number'
ON CONFLICT (contract_id, task_number) DO UPDATE
SET 
  spent_uf = EXCLUDED.spent_uf,
  budget_uf = EXCLUDED.budget_uf,
  task_name = EXCLUDED.task_name,
  progress_percentage = EXCLUDED.progress_percentage,
  updated_at = NOW();