-- FASE 1: Actualizar contrato existente "4600028079" con datos del último documento procesado

WITH latest_doc AS (
  SELECT 
    extracted_data
  FROM documents
  WHERE contract_id = '69967074-8c44-4b62-b1a1-373d9ef43f83'
    AND doc_type = 'contract'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE contracts c
SET 
  title = (SELECT extracted_data->>'title' FROM latest_doc),
  metadata = COALESCE(c.metadata, '{}'::jsonb) || (
    SELECT jsonb_build_object(
      'contract_code', extracted_data->>'contract_code',
      'client', extracted_data->>'client',
      'contractor', extracted_data->>'contractor',
      'budget_uf', (extracted_data->>'budget_uf')::numeric,
      'start_date', extracted_data->>'start_date',
      'end_date', extracted_data->>'end_date',
      'total_budget', extracted_data->'total_budget',
      'parties_involved', extracted_data->'parties_involved',
      'payment_terms', extracted_data->'payment_terms',
      'key_deliverables_and_milestones', extracted_data->'key_deliverables_and_milestones',
      'spent_uf', COALESCE((c.metadata->>'spent_uf')::numeric, 0),
      'available_uf', (extracted_data->>'budget_uf')::numeric - COALESCE((c.metadata->>'spent_uf')::numeric, 0),
      'overall_progress_pct', COALESCE((c.metadata->>'overall_progress_pct')::numeric, 0),
      'edps_paid', COALESCE((c.metadata->>'edps_paid')::integer, 0),
      'last_updated', NOW()
    )
    FROM latest_doc
  ),
  updated_at = NOW()
WHERE c.id = '69967074-8c44-4b62-b1a1-373d9ef43f83';

-- Verificar actualización
SELECT 
  code,
  title,
  metadata->>'client' as client,
  metadata->>'contractor' as contractor,
  metadata->>'budget_uf' as budget_uf,
  metadata->>'start_date' as start_date
FROM contracts
WHERE code = '4600028079';