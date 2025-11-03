-- Create trigger function to calculate task progress automatically
CREATE OR REPLACE FUNCTION calculate_task_progress()
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

-- Create trigger on contract_tasks
DROP TRIGGER IF EXISTS update_task_progress ON contract_tasks;
CREATE TRIGGER update_task_progress
BEFORE INSERT OR UPDATE OF spent_uf, budget_uf ON contract_tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_task_progress();

-- Modify refresh_contract_metrics to also recalculate task percentages
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
  
  -- Recalculate all task percentages (backup mechanism)
  UPDATE contract_tasks
  SET progress_percentage = CASE 
    WHEN budget_uf > 0 THEN ROUND((spent_uf / budget_uf) * 100)
    ELSE 0
  END,
  updated_at = NOW()
  WHERE contract_id = v_contract_id;
  
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