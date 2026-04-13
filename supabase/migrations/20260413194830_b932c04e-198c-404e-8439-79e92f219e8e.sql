
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Edge function uses service role, so no user-facing policies needed.
-- But allow anon insert for the edge function pattern:
CREATE POLICY "Service role can manage waitlist"
ON public.waitlist
FOR ALL
USING (true)
WITH CHECK (true);
