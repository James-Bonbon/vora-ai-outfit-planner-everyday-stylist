
-- Create temp_uploads bucket for camera captures
INSERT INTO storage.buckets (id, name, public) VALUES ('temp-uploads', 'temp-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to temp-uploads
CREATE POLICY "Authenticated users can upload temp files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'temp-uploads' AND auth.uid() IS NOT NULL);

-- Allow public read for AI processing
CREATE POLICY "Public read for temp uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-uploads');

-- Allow users to delete their own temp files
CREATE POLICY "Users can delete own temp files"
ON storage.objects FOR DELETE
USING (bucket_id = 'temp-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
