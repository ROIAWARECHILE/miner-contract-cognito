-- =============================================================================
-- LIMPIEZA DE MÓDULOS INESTABLES - ContractOS Restructuring
-- =============================================================================
-- Este script elimina todas las tablas y funciones relacionadas con:
-- - Resúmenes ejecutivos (contract_summaries)
-- - Asistente IA (chat_sessions, chat_messages)
-- - Riesgos y Obligaciones (contract_risks, contract_obligations)
-- - Embeddings y chunks (contract_embeddings, clause_embeddings, document_chunks)
-- - Anomalías (contract_anomalies)
-- - Auditorías de resumen (contract_summaries_audit)
--
-- MANTIENE ÚNICAMENTE:
-- - contracts, documents, payment_states, contract_tasks, technical_reports
-- - document_processing_jobs, ingest_jobs, ingest_logs
-- - profiles, alerts
-- =============================================================================

-- 1. ELIMINAR TABLAS DE CHAT/ASISTENTE IA
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

-- 2. ELIMINAR TABLAS DE RESUMEN EJECUTIVO
DROP TABLE IF EXISTS contract_summaries_audit CASCADE;
DROP TABLE IF EXISTS contract_summaries CASCADE;

-- 3. ELIMINAR TABLAS DE RIESGOS Y OBLIGACIONES
DROP TABLE IF EXISTS contract_obligations CASCADE;
DROP TABLE IF EXISTS contract_risks CASCADE;

-- 4. ELIMINAR TABLAS DE EMBEDDINGS Y CHUNKS
DROP TABLE IF EXISTS clause_embeddings CASCADE;
DROP TABLE IF EXISTS contract_embeddings CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;

-- 5. ELIMINAR TABLAS DE ANÁLISIS IA Y ANOMALÍAS
DROP TABLE IF EXISTS contract_anomalies CASCADE;
DROP TABLE IF EXISTS analysis_cache CASCADE;
DROP TABLE IF EXISTS analysis_progress CASCADE;

-- 6. ELIMINAR FUNCIONES RELACIONADAS (si existen)
DROP FUNCTION IF EXISTS refresh_contract_summary(text) CASCADE;
DROP FUNCTION IF EXISTS generate_summary_embedding(uuid) CASCADE;
DROP FUNCTION IF EXISTS search_similar_contracts(vector, integer) CASCADE;

-- 7. LOG DE LIMPIEZA
INSERT INTO audit_log (entity_type, entity_id, action, user_email, diff_json)
VALUES (
  'system',
  gen_random_uuid(),
  'database_cleanup',
  'system',
  jsonb_build_object(
    'action', 'cleanup_unstable_modules',
    'timestamp', now(),
    'tables_dropped', jsonb_build_array(
      'chat_messages',
      'chat_sessions',
      'contract_summaries_audit',
      'contract_summaries',
      'contract_obligations',
      'contract_risks',
      'clause_embeddings',
      'contract_embeddings',
      'document_chunks',
      'contract_anomalies',
      'analysis_cache',
      'analysis_progress'
    )
  )
);