-- Create contract_tasks table for tracking individual task progress
CREATE TABLE IF NOT EXISTS public.contract_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL,
  task_name TEXT NOT NULL,
  budget_uf DECIMAL(12,2),
  spent_uf DECIMAL(12,2) DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, task_number)
);

-- Enable RLS
ALTER TABLE public.contract_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view tasks"
  ON public.contract_tasks
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Legal and admins can manage tasks"
  ON public.contract_tasks
  FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));

-- Create trigger for updated_at
CREATE TRIGGER update_contract_tasks_updated_at
  BEFORE UPDATE ON public.contract_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON public.documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_contract_id ON public.ai_analyses(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_tasks_contract_id ON public.contract_tasks(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_tasks_task_number ON public.contract_tasks(contract_id, task_number);