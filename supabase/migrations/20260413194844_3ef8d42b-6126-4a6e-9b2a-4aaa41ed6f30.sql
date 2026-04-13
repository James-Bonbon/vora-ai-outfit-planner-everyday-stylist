
DROP POLICY "Service role can manage waitlist" ON public.waitlist;

-- Allow inserts from anon (edge function uses service role which bypasses RLS anyway)
CREATE POLICY "Allow anon insert to waitlist"
ON public.waitlist
FOR INSERT
WITH CHECK (true);
