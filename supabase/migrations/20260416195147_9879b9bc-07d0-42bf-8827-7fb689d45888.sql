-- Idempotent: chat usage events for server-side rate limiting
CREATE TABLE IF NOT EXISTS public.chat_usage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_usage_events_user_created
  ON public.chat_usage_events (user_id, created_at DESC);

ALTER TABLE public.chat_usage_events ENABLE ROW LEVEL SECURITY;

-- Users may read their own usage (for transparency); writes are service-role only.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_usage_events'
      AND policyname = 'Users can view their own chat usage'
  ) THEN
    CREATE POLICY "Users can view their own chat usage"
      ON public.chat_usage_events
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;