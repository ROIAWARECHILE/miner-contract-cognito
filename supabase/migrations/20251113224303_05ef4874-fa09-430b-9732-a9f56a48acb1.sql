-- Crear función RPC para obtener métricas de salud de DB
CREATE OR REPLACE FUNCTION public.get_db_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_contracts', (SELECT COUNT(*) FROM contracts),
    'active_contracts', (SELECT COUNT(*) FROM contracts WHERE status = 'active'),
    'total_documents', (SELECT COUNT(*) FROM documents),
    'total_storage_bytes', (SELECT COALESCE(SUM(file_size), 0) FROM documents),
    'failed_jobs', (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'failed'),
    'stuck_jobs', (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '2 hours'),
    'stale_ingest_jobs', (SELECT COUNT(*) FROM ingest_jobs WHERE status = 'queued' AND created_at < NOW() - INTERVAL '1 day'),
    'recent_logs', (SELECT COUNT(*) FROM ingest_logs WHERE created_at > NOW() - INTERVAL '7 days'),
    'recent_audit_logs', (SELECT COUNT(*) FROM audit_log WHERE timestamp > NOW() - INTERVAL '30 days'),
    'active_cache_entries', (SELECT COUNT(*) FROM analysis_cache WHERE expires_at > NOW()),
    'avg_processing_time_ms', (SELECT COALESCE(AVG(processing_time_ms), 0) FROM ai_analyses WHERE created_at > NOW() - INTERVAL '7 days'),
    'last_updated', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Dar permisos para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_db_health_metrics() TO authenticated;