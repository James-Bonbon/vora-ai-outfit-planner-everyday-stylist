
-- Create closet_items table
CREATE TABLE public.closet_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT,
  color TEXT,
  material TEXT,
  brand TEXT,
  name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.closet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own closet items"
ON public.closet_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own closet items"
ON public.closet_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own closet items"
ON public.closet_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own closet items"
ON public.closet_items FOR DELETE
USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_closet_items_updated_at
BEFORE UPDATE ON public.closet_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for garment photos
INSERT INTO storage.buckets (id, name, public) VALUES ('garments', 'garments', false);

CREATE POLICY "Users can upload their own garment photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'garments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own garment photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'garments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own garment photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'garments' AND auth.uid()::text = (storage.foldername(name))[1]);
