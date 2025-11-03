-- Recalcular porcentajes de todas las tareas existentes
UPDATE contract_tasks
SET progress_percentage = CASE 
  WHEN budget_uf > 0 THEN ROUND((spent_uf / budget_uf) * 100)
  ELSE 0
END,
updated_at = NOW();