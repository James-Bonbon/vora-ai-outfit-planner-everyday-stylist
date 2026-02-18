
-- Catalog table to cache externally fetched beauty products with AI-standardized categories
CREATE TABLE public.beauty_products_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  image_url TEXT,
  price TEXT,
  rating NUMERIC,
  reviews INTEGER DEFAULT 0,
  product_link TEXT,
  store TEXT,
  standardized_category TEXT NOT NULL DEFAULT 'Other',
  search_query TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast category filtering
CREATE INDEX idx_catalog_standardized_category ON public.beauty_products_catalog (standardized_category);

-- Index for cache lookups by search query
CREATE INDEX idx_catalog_search_query ON public.beauty_products_catalog (search_query);

-- Enable RLS
ALTER TABLE public.beauty_products_catalog ENABLE ROW LEVEL SECURITY;

-- Public read access (catalog data, no user ownership)
CREATE POLICY "Anyone can read catalog" ON public.beauty_products_catalog
  FOR SELECT USING (true);

-- Only service role can insert/update/delete (edge functions use service role)
