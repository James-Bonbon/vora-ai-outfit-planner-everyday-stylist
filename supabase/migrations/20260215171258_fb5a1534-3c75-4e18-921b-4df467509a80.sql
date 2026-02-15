
-- Create storage bucket for selfie uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('selfies', 'selfies', false);

-- Users can upload their own selfie
CREATE POLICY "Users can upload their own selfie"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own selfie
CREATE POLICY "Users can view their own selfie"
ON storage.objects FOR SELECT
USING (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own selfie
CREATE POLICY "Users can update their own selfie"
ON storage.objects FOR UPDATE
USING (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own selfie
CREATE POLICY "Users can delete their own selfie"
ON storage.objects FOR DELETE
USING (bucket_id = 'selfies' AND auth.uid()::text = (storage.foldername(name))[1]);
