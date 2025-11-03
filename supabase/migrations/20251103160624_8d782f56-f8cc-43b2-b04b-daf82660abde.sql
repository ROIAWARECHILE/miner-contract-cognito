-- Add document_type column to ingest_jobs table
ALTER TABLE ingest_jobs 
ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_document_type 
ON ingest_jobs(document_type);

-- Update existing jobs with default type
UPDATE ingest_jobs 
SET document_type = 'contract' 
WHERE document_type IS NULL;