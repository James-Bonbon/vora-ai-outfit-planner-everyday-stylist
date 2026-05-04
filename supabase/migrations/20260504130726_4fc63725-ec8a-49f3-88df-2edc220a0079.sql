ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS product_reference jsonb,
  ADD COLUMN IF NOT EXISTS debug_info jsonb;

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_user_product_ref_idx
  ON public.chat_messages (user_id, created_at DESC)
  WHERE product_reference IS NOT NULL;