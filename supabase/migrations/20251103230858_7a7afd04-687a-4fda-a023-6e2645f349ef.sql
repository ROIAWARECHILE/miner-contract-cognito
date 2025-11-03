-- Función para restar spent_uf de una tarea específica al eliminar un EDP
CREATE OR REPLACE FUNCTION public.subtract_task_spent(
  p_contract_id UUID,
  p_task_number TEXT,
  p_amount_to_subtract NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE contract_tasks
  SET 
    spent_uf = GREATEST(0, spent_uf - p_amount_to_subtract),
    progress_percentage = CASE 
      WHEN budget_uf > 0 THEN 
        ROUND((GREATEST(0, spent_uf - p_amount_to_subtract) / budget_uf) * 100)
      ELSE 0
    END,
    updated_at = NOW()
  WHERE 
    contract_id = p_contract_id
    AND task_number = p_task_number;
END;
$$;