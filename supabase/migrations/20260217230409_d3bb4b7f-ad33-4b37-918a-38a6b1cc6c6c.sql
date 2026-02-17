CREATE TABLE public.dream_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id UUID,
  image_url TEXT NOT NULL,
  name TEXT,
  price NUMERIC,
  brand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dream_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dream items"
  ON public.dream_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dream items"
  ON public.dream_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dream items"
  ON public.dream_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);