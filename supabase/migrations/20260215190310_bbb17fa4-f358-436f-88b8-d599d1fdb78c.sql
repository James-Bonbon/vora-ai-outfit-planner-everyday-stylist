
-- Storage bucket for generated try-on images
INSERT INTO storage.buckets (id, name, public) VALUES ('looks', 'looks', false);

-- RLS policies for looks bucket
CREATE POLICY "Users can upload their own looks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own looks"
ON storage.objects FOR SELECT
USING (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own looks"
ON storage.objects FOR DELETE
USING (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Looks table
CREATE TABLE public.looks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  occasion TEXT,
  garment_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own looks"
ON public.looks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own looks"
ON public.looks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own looks"
ON public.looks FOR DELETE
USING (auth.uid() = user_id);
