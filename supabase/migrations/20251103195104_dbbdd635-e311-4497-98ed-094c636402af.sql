-- Create unified document processing jobs table
CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  llama_job_id TEXT,
  progress JSONB DEFAULT '{}'::JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_status ON document_processing_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_contract ON document_processing_jobs(contract_id, created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_document_processing_jobs_updated_at
  BEFORE UPDATE ON document_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access for now, can be restricted later)
CREATE POLICY "Allow all access to document_processing_jobs"
  ON document_processing_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);