-- Remove duplicate names keeping only the newest entry
DELETE FROM public.beauty_products_catalog a
USING public.beauty_products_catalog b
WHERE a.name = b.name AND a.created_at < b.created_at;

-- Now create the unique index
CREATE UNIQUE INDEX idx_beauty_products_catalog_name ON public.beauty_products_catalog (name);