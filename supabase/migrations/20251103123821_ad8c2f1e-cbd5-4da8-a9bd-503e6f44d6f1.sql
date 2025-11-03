-- Add metadata column to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.contracts.metadata IS 'Stores computed KPIs: spent_uf, available_uf, overall_progress_pct, s_curve_real, kpis_plan, etc.';

-- Create payment_states table for EDPs
CREATE TABLE IF NOT EXISTS public.payment_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  edp_number INTEGER NOT NULL,
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  amount_uf NUMERIC(12,2),
  uf_rate NUMERIC(12,4),
  amount_clp NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approval_date TIMESTAMP WITH TIME ZONE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(contract_id, edp_number)
);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_states_updated_at
  BEFORE UPDATE ON public.payment_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.payment_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view payment states"
  ON public.payment_states FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Legal and admins can manage payment states"
  ON public.payment_states FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payment_states_contract_id ON public.payment_states(contract_id);
CREATE INDEX IF NOT EXISTS idx_payment_states_status ON public.payment_states(status);
CREATE INDEX IF NOT EXISTS idx_payment_states_period ON public.payment_states(period_start, period_end);