-- Add summary_json column to contract_summaries for executive summary cards
ALTER TABLE contract_summaries 
ADD COLUMN IF NOT EXISTS summary_json JSONB DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_contract_summaries_summary_json 
ON contract_summaries USING GIN (summary_json);

-- Add comment
COMMENT ON COLUMN contract_summaries.summary_json IS 'Executive summary structured as cards for dashboard display';
