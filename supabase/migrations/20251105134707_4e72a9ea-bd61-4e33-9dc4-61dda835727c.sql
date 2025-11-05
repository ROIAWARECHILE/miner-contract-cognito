-- Tabla para persistir memorandums/reportes técnicos con curvas S
CREATE TABLE IF NOT EXISTS technical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_code TEXT NOT NULL,
  
  -- Metadatos del memorandum
  edp_number INT,
  memo_ref TEXT,
  version TEXT,
  date_issued DATE,
  author TEXT,
  organization TEXT,
  period_start DATE,
  period_end DATE,
  
  -- Datos estructurados
  activities_summary JSONB DEFAULT '[]'::JSONB,
  curve JSONB DEFAULT '{}'::JSONB,  -- { unit, dates[], planned[], executed[], source_section, notes[] }
  financial JSONB DEFAULT '{}'::JSONB,  -- { contract_budget_uf, progress_pct, edp_amount_uf, accumulated_total_uf }
  figures JSONB DEFAULT '[]'::JSONB,
  attachments JSONB DEFAULT '[]'::JSONB,
  
  -- Metadata de extracción
  extraction_meta JSONB DEFAULT '{}'::JSONB,  -- { extraction_checks, inferences, missing, review_required }
  
  -- JSON completo parseado
  parsed_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices para consultas frecuentes
  CONSTRAINT unique_memo_per_contract_edp UNIQUE (contract_code, edp_number, version)
);

-- Índices para mejorar performance
CREATE INDEX idx_technical_reports_contract_id ON technical_reports(contract_id);
CREATE INDEX idx_technical_reports_contract_code ON technical_reports(contract_code);
CREATE INDEX idx_technical_reports_edp_number ON technical_reports(edp_number);
CREATE INDEX idx_technical_reports_date_issued ON technical_reports(date_issued);
CREATE INDEX idx_technical_reports_period_start ON technical_reports(period_start);

-- RLS Policies (Row Level Security)
ALTER TABLE technical_reports ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden leer todos los reportes técnicos
CREATE POLICY "Authenticated users can view technical reports"
  ON technical_reports FOR SELECT
  TO authenticated
  USING (true);

-- Política: Legal y admins pueden gestionar reportes técnicos
CREATE POLICY "Legal and admins can manage technical reports"
  ON technical_reports FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_technical_reports_updated_at
  BEFORE UPDATE ON technical_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE technical_reports IS 'Memorandums técnicos y reportes de progreso (Respaldos EDP) con curvas S';
COMMENT ON COLUMN technical_reports.curve IS 'Curva S con dates[], planned[], executed[] en HH o UF';
COMMENT ON COLUMN technical_reports.financial IS 'Datos financieros contextuales (no reemplazan datos contables de EDPs)';
COMMENT ON COLUMN technical_reports.extraction_meta IS 'Metadatos de validación: equal_lengths, monotonic_increase, units_consistent, review_required';