-- Mark stuck memorandum jobs as failed
UPDATE document_processing_jobs
SET 
  status = 'failed',
  error = 'Job failed: invalid document_type enum value - fixed in migration',
  updated_at = NOW()
WHERE storage_path LIKE '%ITASCA-MEM-4065.001.01-Respaldo_EdP1-R0.pdf'
  AND status = 'processing';

-- Also cleanup any other stale processing jobs (>1 hour old)
UPDATE document_processing_jobs
SET 
  status = 'failed',
  error = 'Job timeout: exceeded 1 hour without completion',
  updated_at = NOW()
WHERE 
  status = 'processing'
  AND updated_at < NOW() - INTERVAL '1 hour';