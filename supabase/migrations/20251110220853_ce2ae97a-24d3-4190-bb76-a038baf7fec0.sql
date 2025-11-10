-- Sprint 1: Add UNIQUE constraints to fix upsert issues

-- 1. Add UNIQUE constraint on contract_summaries (contract_id)
ALTER TABLE contract_summaries DROP CONSTRAINT IF EXISTS contract_summaries_contract_id_key;
ALTER TABLE contract_summaries ADD CONSTRAINT contract_summaries_contract_id_key UNIQUE (contract_id);

-- 2. Add composite UNIQUE constraint on contract_risks
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_risks_unique 
  ON contract_risks (contract_id, title, COALESCE(clause_ref, ''));

-- 3. Add composite UNIQUE constraint on contract_obligations
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_obligations_unique 
  ON contract_obligations (contract_id, name, type);