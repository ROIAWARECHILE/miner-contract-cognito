-- Create tables for new LlamaParse + OpenAI pipeline
CREATE TABLE IF NOT EXISTS public.edp_raw_parsed (
  id BIGSERIAL PRIMARY KEY,
  contract_code TEXT NOT NULL,
  edp_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  llama_job_id TEXT,
  parsed_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.edp_extracted (
  id BIGSERIAL PRIMARY KEY,
  contract_code TEXT NOT NULL,
  edp_number INTEGER NOT NULL,
  structured_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.edp_raw_parsed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edp_extracted ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view raw parsed EDPs"
  ON public.edp_raw_parsed FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert raw parsed EDPs"
  ON public.edp_raw_parsed FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view extracted EDPs"
  ON public.edp_extracted FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert extracted EDPs"
  ON public.edp_extracted FOR INSERT
  WITH CHECK (true);

-- Create RPC function to refresh contract metrics
CREATE OR REPLACE FUNCTION public.refresh_contract_metrics(contract_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;