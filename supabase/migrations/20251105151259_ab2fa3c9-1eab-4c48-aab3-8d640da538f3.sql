-- Add 'memorandum' to document_type enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'memorandum' 
    AND enumtypid = 'document_type'::regtype
  ) THEN
    ALTER TYPE document_type ADD VALUE 'memorandum';
  END IF;
END $$;