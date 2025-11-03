-- Add contract_id to ingest_jobs table
ALTER TABLE public.ingest_jobs 
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_contract_id 
ON public.ingest_jobs(contract_id);

-- Add processing metadata to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

-- Create index for processing status queries
CREATE INDEX IF NOT EXISTS idx_documents_processing_status 
ON public.documents(processing_status);

-- Create index for contract_id lookups
CREATE INDEX IF NOT EXISTS idx_documents_contract_id 
ON public.documents(contract_id);