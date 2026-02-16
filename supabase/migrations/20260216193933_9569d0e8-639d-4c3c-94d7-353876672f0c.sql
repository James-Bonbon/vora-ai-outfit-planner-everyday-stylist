
-- Create beauty-products storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('beauty-products', 'beauty-products', false);

-- Storage policies for beauty-products bucket
CREATE POLICY "Users can upload their own beauty product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'beauty-products' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own beauty product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'beauty-products' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own beauty product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'beauty-products' AND auth.uid()::text = (storage.foldername(name))[1]);
