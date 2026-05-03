CREATE TABLE IF NOT EXISTS public.product_link_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_url TEXT NOT NULL UNIQUE,
  original_url TEXT,
  final_url TEXT,
  product_ref JSONB,
  shopping_results JSONB,
  extraction_source TEXT,
  confidence NUMERIC,
  failure_reason TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_link_cache_fetched_at
  ON public.product_link_cache (fetched_at DESC);

ALTER TABLE public.product_link_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_link_cache'
      AND policyname = 'Authenticated users can read product link cache'
  ) THEN
    CREATE POLICY "Authenticated users can read product link cache"
      ON public.product_link_cache
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_product_link_cache_updated_at ON public.product_link_cache;
CREATE TRIGGER update_product_link_cache_updated_at
  BEFORE UPDATE ON public.product_link_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();