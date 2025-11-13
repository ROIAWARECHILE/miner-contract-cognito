-- Tabla de auditoría para cambios en contract_summaries
CREATE TABLE IF NOT EXISTS contract_summaries_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_code text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert', 'update', 'merge')),
  old_cards_count integer,
  new_cards_count integer,
  cards_added text[],
  cards_updated text[],
  triggered_by text,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_summaries_audit_contract_code ON contract_summaries_audit(contract_code);
CREATE INDEX idx_summaries_audit_created_at ON contract_summaries_audit(created_at DESC);

-- RLS: Authenticated users can read audit logs
ALTER TABLE contract_summaries_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
  ON contract_summaries_audit FOR SELECT
  TO authenticated
  USING (true);

-- Sistema puede insertar logs
CREATE POLICY "System can insert audit logs"
  ON contract_summaries_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);