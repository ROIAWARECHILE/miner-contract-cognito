-- FASE 2: Partial unique index para technical_reports
-- Este index permite múltiples memorandums sin edp_number,
-- pero evita duplicados cuando SÍ tiene edp_number

-- Eliminar el constraint anterior si existe
ALTER TABLE technical_reports DROP CONSTRAINT IF EXISTS unique_memo_per_contract_edp;

-- Crear partial unique index que solo aplica cuando edp_number NO es NULL
CREATE UNIQUE INDEX IF NOT EXISTS unique_memo_with_edp 
ON technical_reports (contract_code, edp_number, version)
WHERE edp_number IS NOT NULL;

-- Comentario explicativo
COMMENT ON INDEX unique_memo_with_edp IS 
'Partial unique index: permite múltiples memos sin edp_number, pero evita duplicados cuando edp_number está presente';