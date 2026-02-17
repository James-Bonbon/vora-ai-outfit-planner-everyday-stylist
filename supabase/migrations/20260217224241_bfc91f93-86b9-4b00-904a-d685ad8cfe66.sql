
-- Cache table for generated looks to avoid paying for duplicate AI generations
CREATE TABLE public.generated_looks_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_hash TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast hash lookups
CREATE INDEX idx_generated_looks_cache_hash ON public.generated_looks_cache (input_hash);

-- Enable RLS
ALTER TABLE public.generated_looks_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache entries (cache is shared - same input = same output)
CREATE POLICY "Authenticated users can read cache"
  ON public.generated_looks_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Only edge functions (service role) will insert into cache, so no INSERT policy for users
