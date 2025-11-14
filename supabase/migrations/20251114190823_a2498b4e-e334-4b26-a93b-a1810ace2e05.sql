-- Drop existing function
DROP FUNCTION IF EXISTS public.delete_contract_cascade(uuid);

-- Create improved function that returns deletion metadata
CREATE OR REPLACE FUNCTION public.delete_contract_cascade(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract_code text;
  v_storage_paths text[];
  v_deleted_counts jsonb;
BEGIN
  -- Get contract code and storage paths BEFORE deleting
  SELECT code INTO v_contract_code
  FROM contracts
  WHERE id = p_contract_id;
  
  -- If contract doesn't exist, return null
  IF v_contract_code IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Collect all file URLs from documents
  SELECT array_agg(DISTINCT file_url)
  INTO v_storage_paths
  FROM documents
  WHERE contract_id = p_contract_id
    AND file_url IS NOT NULL;
  
  -- Delete in correct order respecting foreign keys
  DELETE FROM clause_embeddings WHERE clause_id IN (SELECT id FROM clauses WHERE contract_id = p_contract_id);
  DELETE FROM contract_embeddings WHERE contract_id = p_contract_id;
  DELETE FROM ai_analyses WHERE contract_id = p_contract_id;
  DELETE FROM analysis_cache WHERE contract_id = p_contract_id;
  DELETE FROM analysis_progress WHERE contract_id = p_contract_id;
  DELETE FROM contract_text_chunks WHERE contract_id = p_contract_id;
  DELETE FROM document_chunks WHERE contract_id = p_contract_id;
  DELETE FROM clauses WHERE contract_id = p_contract_id;
  DELETE FROM obligations WHERE contract_id = p_contract_id;
  DELETE FROM risk_events WHERE contract_id = p_contract_id;
  DELETE FROM royalty_terms WHERE contract_id = p_contract_id;
  DELETE FROM contract_anomalies WHERE contract_id = p_contract_id;
  DELETE FROM renewal_predictions WHERE contract_id = p_contract_id;
  DELETE FROM regulatory_impacts WHERE contract_id = p_contract_id;
  DELETE FROM relationships 
  WHERE (source_type = 'contract' AND source_id::text = p_contract_id::text) 
     OR (target_type = 'contract' AND target_id::text = p_contract_id::text);
  
  -- Delete contract-related data
  WITH deleted_docs AS (
    DELETE FROM documents WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_summaries AS (
    DELETE FROM contract_summaries WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_tasks AS (
    DELETE FROM contract_tasks WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_payments AS (
    DELETE FROM payment_states WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_obligations AS (
    DELETE FROM contract_obligations WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_risks AS (
    DELETE FROM contract_risks WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_reports AS (
    DELETE FROM technical_reports WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_jobs AS (
    DELETE FROM document_processing_jobs WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_ingest_jobs AS (
    DELETE FROM ingest_jobs WHERE contract_id = p_contract_id RETURNING id
  ),
  deleted_contract AS (
    DELETE FROM contracts WHERE id = p_contract_id RETURNING id
  )
  SELECT jsonb_build_object(
    'documents', (SELECT count(*) FROM deleted_docs),
    'summaries', (SELECT count(*) FROM deleted_summaries),
    'tasks', (SELECT count(*) FROM deleted_tasks),
    'payments', (SELECT count(*) FROM deleted_payments),
    'obligations', (SELECT count(*) FROM deleted_obligations),
    'risks', (SELECT count(*) FROM deleted_risks),
    'reports', (SELECT count(*) FROM deleted_reports),
    'jobs', (SELECT count(*) FROM deleted_jobs),
    'ingest_jobs', (SELECT count(*) FROM deleted_ingest_jobs),
    'contract', (SELECT count(*) FROM deleted_contract)
  ) INTO v_deleted_counts;
  
  -- Log deletion in audit_log
  INSERT INTO audit_log (entity_type, entity_id, action, user_id, user_email)
  VALUES ('contract', p_contract_id::text, 'delete', auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()));
  
  -- Return metadata
  RETURN jsonb_build_object(
    'contract_code', v_contract_code,
    'storage_paths', COALESCE(v_storage_paths, ARRAY[]::text[]),
    'deleted_records', v_deleted_counts
  );
END;
$function$;