-- Set default values for user tracking columns to automatically use auth.uid()
-- This ensures created_by and uploaded_by are always populated even if not explicitly set

-- Set default for created_by in contracts table
ALTER TABLE public.contracts 
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Set default for uploaded_by in documents table  
ALTER TABLE public.documents 
ALTER COLUMN uploaded_by SET DEFAULT auth.uid();