-- Drop existing table if any
DROP TABLE IF EXISTS contract_summaries CASCADE;

-- Create optimized contract_summaries table
CREATE TABLE contract_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contract_code TEXT NOT NULL UNIQUE,
  
  -- AI extraction results
  extracted_json JSONB NOT NULL,
  
  -- Processing metadata
  extraction_method TEXT DEFAULT 'gpt-4o',
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  processing_time_ms INTEGER,
  
  -- Review workflow
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'flagged', 'approved')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Version control
  version INTEGER DEFAULT 1,
  
  -- Provenance
  source_document_id UUID REFERENCES documents(id),
  extracted_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contract_summaries_contract_id ON contract_summaries(contract_id);
CREATE INDEX idx_contract_summaries_code ON contract_summaries(contract_code);
CREATE INDEX idx_contract_summaries_review_status ON contract_summaries(review_status);
CREATE INDEX idx_contract_summaries_json ON contract_summaries USING GIN(extracted_json);

-- Trigger for updated_at
CREATE TRIGGER update_contract_summaries_updated_at
  BEFORE UPDATE ON contract_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE contract_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view summaries"
  ON contract_summaries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Legal and admins can manage summaries"
  ON contract_summaries FOR ALL
  TO authenticated 
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));

-- Comments for documentation
COMMENT ON TABLE contract_summaries IS 'Stores validated AI-extracted contract data from contractAgent';
COMMENT ON COLUMN contract_summaries.review_status IS 'Workflow status: pending (new), flagged (needs review), reviewed (checked), approved (final)';
COMMENT ON COLUMN contract_summaries.extracted_json IS 'Validated output from ContractSummarySchema matching identificacion, partes, precio_y_pago, etc.';