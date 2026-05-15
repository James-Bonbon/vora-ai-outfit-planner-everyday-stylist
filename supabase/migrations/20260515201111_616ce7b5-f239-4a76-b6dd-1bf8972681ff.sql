ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS products jsonb,
  ADD COLUMN IF NOT EXISTS product_search jsonb;