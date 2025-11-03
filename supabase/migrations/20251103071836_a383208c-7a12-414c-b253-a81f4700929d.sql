-- Drop existing restrictive INSERT policies
DROP POLICY IF EXISTS "Legal and admins can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Legal and admins can insert documents" ON public.documents;

-- Create more permissive INSERT policies for authenticated users

-- Contracts: Allow authenticated users to create draft contracts
CREATE POLICY "Authenticated users can create contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Documents: Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Keep existing SELECT, UPDATE, DELETE policies restrictive
-- (No changes to existing SELECT, UPDATE, DELETE policies)