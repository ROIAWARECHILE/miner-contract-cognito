-- Fix delete_contract_cascade function
-- Remove reference to non-existent clause_embeddings table

DROP FUNCTION IF EXISTS delete_contract_cascade(uuid);

CREATE OR REPLACE FUNCTION delete_contract_cascade(p_contract_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_code TEXT;
  v_storage_paths TEXT[];
  v_deleted_counts JSON;
BEGIN
  -- Get contract code for response
  SELECT code INTO v_contract_code
  FROM contracts
  WHERE id = p_contract_id;

  IF v_contract_code IS NULL THEN
    RAISE EXCEPTION 'Contract not found with id: %', p_contract_id;
  END IF;

  -- Collect all storage paths from documents before deletion
  SELECT ARRAY_AGG(file_url)
  INTO v_storage_paths
  FROM documents
  WHERE contract_id = p_contract_id;

  -- Delete related records in order (respecting foreign keys)
  
  -- Delete AI analyses
  DELETE FROM ai_analyses WHERE contract_id = p_contract_id;
  
  -- Delete technical reports
  DELETE FROM technical_reports WHERE contract_id = p_contract_id;
  
  -- Delete payment states
  DELETE FROM payment_states WHERE contract_id = p_contract_id;
  
  -- Delete contract tasks
  DELETE FROM contract_tasks WHERE contract_id = p_contract_id;
  
  -- Delete contract summaries
  DELETE FROM contract_summaries WHERE contract_id = p_contract_id;
  
  -- Delete contract text chunks
  DELETE FROM contract_text_chunks WHERE contract_id = p_contract_id;
  
  -- Delete obligations
  DELETE FROM obligations WHERE contract_id = p_contract_id;
  
  -- Delete risk events
  DELETE FROM risk_events WHERE contract_id = p_contract_id;
  
  -- Delete regulatory impacts
  DELETE FROM regulatory_impacts WHERE contract_id = p_contract_id;
  
  -- Delete renewal predictions
  DELETE FROM renewal_predictions WHERE contract_id = p_contract_id;
  
  -- Delete royalty terms
  DELETE FROM royalty_terms WHERE contract_id = p_contract_id;
  
  -- Delete clauses
  DELETE FROM clauses WHERE contract_id = p_contract_id;
  
  -- Delete document processing jobs
  DELETE FROM document_processing_jobs WHERE contract_id = p_contract_id;
  
  -- Delete documents
  DELETE FROM documents WHERE contract_id = p_contract_id;
  
  -- Finally delete the contract itself
  DELETE FROM contracts WHERE id = p_contract_id;

  -- Build response with deleted counts
  v_deleted_counts := json_build_object(
    'documents', COALESCE(array_length(v_storage_paths, 1), 0),
    'contract_code', v_contract_code
  );

  RETURN json_build_object(
    'success', true,
    'contract_code', v_contract_code,
    'storage_paths', COALESCE(v_storage_paths, ARRAY[]::TEXT[]),
    'deleted_records', v_deleted_counts
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting contract: %', SQLERRM;
END;
$$;