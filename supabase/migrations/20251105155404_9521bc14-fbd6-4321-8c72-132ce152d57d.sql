-- Limpiar registros huérfanos en technical_reports
-- (documentos que ya no existen en la tabla documents)
DELETE FROM technical_reports tr
WHERE contract_code = 'AIPD-CSI001-1000-MN-0001'
  AND NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.contract_id = tr.contract_id
      AND d.doc_type = 'memorandum'
      AND (d.extracted_data->>'edp_number')::int = tr.edp_number
  );