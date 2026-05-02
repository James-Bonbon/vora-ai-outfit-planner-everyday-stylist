-- Cache for AI outfit scores from gpt-5-mini.
-- Keyed by (user_id, cache_key) where cache_key encodes garments+weather+occasion+date+prefsVersion.
CREATE TABLE IF NOT EXISTS public.outfit_score_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  garment_ids UUID[] NOT NULL,
  score INTEGER NOT NULL,
  decision TEXT NOT NULL,
  confidence NUMERIC,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_outfit_score_cache_user_created
  ON public.outfit_score_cache (user_id, created_at DESC);

ALTER TABLE public.outfit_score_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own outfit score cache"
  ON public.outfit_score_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outfit score cache"
  ON public.outfit_score_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outfit score cache"
  ON public.outfit_score_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
