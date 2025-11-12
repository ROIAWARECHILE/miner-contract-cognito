-- Sprint 1: Add UNIQUE constraint and indexes to contract_summaries
-- This fixes the upsert issue that was causing summary_json to be NULL

-- Add UNIQUE constraint on contract_code
ALTER TABLE contract_summaries 
ADD CONSTRAINT contract_summaries_contract_code_key 
UNIQUE (contract_code);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contract_summaries_contract_code 
ON contract_summaries(contract_code);

CREATE INDEX IF NOT EXISTS idx_contract_summaries_contract_id 
ON contract_summaries(contract_id);

-- Clean up invalid records with NULL summary_json (failed saves)
DELETE FROM contract_summaries 
WHERE summary_json IS NULL;

-- Add comment for documentation
COMMENT ON CONSTRAINT contract_summaries_contract_code_key ON contract_summaries 
IS 'Ensures one summary per contract code for reliable upserts';