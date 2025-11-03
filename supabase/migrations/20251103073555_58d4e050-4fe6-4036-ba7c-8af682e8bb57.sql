-- Solución definitiva: Simplificar políticas RLS para permitir operaciones a usuarios autenticados
-- Eliminar políticas existentes que puedan estar causando conflictos

-- Eliminar políticas existentes de contracts
DROP POLICY IF EXISTS "Authenticated users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Legal and admins can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Legal and admins can delete contracts" ON public.contracts;

-- Crear políticas simplificadas para contracts (MVP)
CREATE POLICY "Anyone authenticated can insert contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone authenticated can view contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins and legal can delete contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));

-- Eliminar políticas existentes de documents
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Legal and admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Legal and admins can delete documents" ON public.documents;

-- Crear políticas simplificadas para documents
CREATE POLICY "Anyone authenticated can insert documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone authenticated can view documents"
ON public.documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone authenticated can update documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins and legal can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'legal_counsel'::app_role]));