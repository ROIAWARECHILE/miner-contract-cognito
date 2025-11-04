-- ============================================
-- FASE 1: Limpieza Inmediata de Jobs Atascados
-- ============================================

-- Eliminar jobs "processing" atascados >24 horas
DELETE FROM document_processing_jobs
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '24 hours';

-- Marcar jobs "processing" actuales como fallidos
UPDATE document_processing_jobs
SET 
  status = 'failed',
  error = 'Timeout: Job exceeded processing time limit',
  updated_at = NOW()
WHERE status = 'processing';

-- Resetear ingest_jobs fallidos para retry (solo con attempts < 3)
UPDATE ingest_jobs
SET 
  status = 'queued',
  attempts = 0,
  last_error = NULL,
  updated_at = NOW()
WHERE status = 'failed'
  AND attempts < 3;

-- ============================================
-- FASE 2: Función de Limpieza Automática
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_processing_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Marcar como failed jobs en processing >2 horas
  UPDATE document_processing_jobs
  SET 
    status = 'failed',
    error = 'Job timeout: exceeded 2 hours without completion',
    updated_at = NOW()
  WHERE 
    status = 'processing'
    AND updated_at < NOW() - INTERVAL '2 hours';
    
  -- Limpiar jobs completados o fallidos >30 días
  DELETE FROM document_processing_jobs
  WHERE 
    status IN ('completed', 'failed')
    AND updated_at < NOW() - INTERVAL '30 days';
    
  -- Limpiar ingest_logs >60 días
  DELETE FROM ingest_logs
  WHERE created_at < NOW() - INTERVAL '60 days';
  
  RAISE NOTICE 'Limpieza automática completada';
END;
$$;

-- Ejecutar limpieza inicial
SELECT cleanup_stale_processing_jobs();

-- Verificar resultados
SELECT 
  status, 
  COUNT(*) as count,
  MAX(updated_at) as last_update
FROM document_processing_jobs
GROUP BY status
ORDER BY status;