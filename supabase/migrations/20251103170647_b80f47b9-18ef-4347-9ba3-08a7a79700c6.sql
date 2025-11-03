-- Storage policies for contracts bucket
-- Allow authenticated users to upload/download/delete from contracts bucket

CREATE POLICY "Authenticated users can upload to contracts bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can read from contracts bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can update in contracts bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts')
WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can delete from contracts bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'contracts');