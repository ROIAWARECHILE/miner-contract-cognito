-- Fase 1: Relajar constraint y crear trigger automático para progress_percentage

-- 1. Eliminar constraint restrictivo que impide progress > 100%
ALTER TABLE contract_tasks 
DROP CONSTRAINT IF EXISTS contract_tasks_progress_percentage_check;

-- 2. Añadir constraint permisivo (solo >= 0)
ALTER TABLE contract_tasks 
ADD CONSTRAINT contract_tasks_progress_percentage_check 
CHECK (progress_percentage >= 0);

-- 3. Crear función trigger para cálculo automático de progress_percentage
CREATE OR REPLACE FUNCTION public.calculate_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_uf > 0 THEN
    NEW.progress_percentage := ROUND((NEW.spent_uf / NEW.budget_uf) * 100);
  ELSE
    NEW.progress_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Aplicar trigger a contract_tasks
DROP TRIGGER IF EXISTS set_task_progress ON contract_tasks;
CREATE TRIGGER set_task_progress
  BEFORE INSERT OR UPDATE ON contract_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_task_progress();

-- 5. Recalcular TODOS los contract_tasks existentes desde payment_states
WITH task_totals AS (
  SELECT 
    ps.contract_id,
    te->>'task_number' AS task_number,
    MAX(te->>'name') AS task_name,
    MAX((te->>'budget_uf')::numeric) AS budget_uf,
    SUM((te->>'spent_uf')::numeric) AS spent_uf_total
  FROM payment_states ps,
    LATERAL jsonb_array_elements(ps.data->'tasks_executed') AS te
  WHERE ps.status IN ('approved', 'submitted')
  GROUP BY ps.contract_id, te->>'task_number'
)
UPDATE contract_tasks ct
SET 
  spent_uf = tt.spent_uf_total,
  updated_at = NOW()
FROM task_totals tt
WHERE ct.contract_id = tt.contract_id
  AND ct.task_number = tt.task_number;

-- 6. Actualizar la función refresh_contract_metrics para incluir recalculación de tareas
CREATE OR REPLACE FUNCTION public.refresh_contract_metrics(contract_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract_id UUID;
  v_budget_uf NUMERIC;
  v_spent_uf NUMERIC;
  v_available_uf NUMERIC;
  v_progress_pct NUMERIC;
  v_edps_paid INTEGER;
BEGIN
  -- Get contract
  SELECT id, metadata->>'budget_uf' INTO v_contract_id, v_budget_uf
  FROM contracts
  WHERE code = contract_code;
  
  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found: %', contract_code;
  END IF;
  
  -- Default budget if not set
  v_budget_uf := COALESCE(v_budget_uf::NUMERIC, 4501);
  
  -- Calculate spent UF from approved payment_states
  SELECT COALESCE(SUM(amount_uf), 0) INTO v_spent_uf
  FROM payment_states
  WHERE contract_id = v_contract_id
    AND status IN ('approved', 'submitted');
  
  -- Calculate metrics
  v_available_uf := v_budget_uf - v_spent_uf;
  v_progress_pct := ROUND((v_spent_uf / NULLIF(v_budget_uf, 0)) * 100);
  
  -- Count paid EDPs
  SELECT COUNT(*) INTO v_edps_paid
  FROM payment_states
  WHERE contract_id = v_contract_id
    AND status = 'approved';
  
  -- Recalcular contract_tasks desde payment_states
  WITH task_totals AS (
    SELECT 
      te->>'task_number' AS task_number,
      MAX(te->>'name') AS task_name,
      MAX((te->>'budget_uf')::numeric) AS budget_uf,
      SUM((te->>'spent_uf')::numeric) AS spent_uf_total
    FROM payment_states ps,
      LATERAL jsonb_array_elements(ps.data->'tasks_executed') AS te
    WHERE ps.contract_id = v_contract_id
      AND ps.status IN ('approved', 'submitted')
    GROUP BY te->>'task_number'
  )
  UPDATE contract_tasks ct
  SET 
    spent_uf = tt.spent_uf_total,
    updated_at = NOW()
  FROM task_totals tt
  WHERE ct.contract_id = v_contract_id
    AND ct.task_number = tt.task_number;
  
  -- Update contract metadata
  UPDATE contracts
  SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
    'budget_uf', v_budget_uf,
    'spent_uf', v_spent_uf,
    'available_uf', v_available_uf,
    'overall_progress_pct', v_progress_pct,
    'edps_paid', v_edps_paid,
    'last_updated', NOW()
  ),
  updated_at = NOW()
  WHERE id = v_contract_id;
END;
$function$;