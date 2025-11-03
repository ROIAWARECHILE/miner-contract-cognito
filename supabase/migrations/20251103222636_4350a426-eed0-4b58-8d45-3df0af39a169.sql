-- Recalcular spent_uf acumulado de todas las tareas manteniendo task_numbers originales
-- NO normalizar: "1", "1.1", "1.2" son tareas distintas

-- Limpiar datos actuales de contract_tasks para el contrato Dominga
DELETE FROM contract_tasks 
WHERE contract_id IN (SELECT id FROM contracts WHERE code = 'AIPD-CSI001-1000-MN-0001');

-- Recalcular spent_uf acumulado sumando TODOS los EDPs por task_number EXACTO
INSERT INTO contract_tasks (contract_id, task_number, task_name, budget_uf, spent_uf, progress_percentage)
SELECT 
  ps.contract_id,
  task_data->>'task_number' as task_number, -- Mantener original: "1", "1.1", "1.2", etc.
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
GROUP BY ps.contract_id, task_data->>'task_number' -- Agrupar por número exacto
ON CONFLICT (contract_id, task_number) DO UPDATE
SET 
  spent_uf = EXCLUDED.spent_uf,
  budget_uf = EXCLUDED.budget_uf,
  task_name = EXCLUDED.task_name,
  progress_percentage = EXCLUDED.progress_percentage,
  updated_at = NOW();