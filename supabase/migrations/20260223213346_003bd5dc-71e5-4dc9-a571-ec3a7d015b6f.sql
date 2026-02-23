ALTER TABLE public.profiles 
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN generations_used integer NOT NULL DEFAULT 0;