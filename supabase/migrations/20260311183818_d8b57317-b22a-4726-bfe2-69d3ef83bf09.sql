
-- The existing "Users can view their own looks" is RESTRICTIVE which blocks community reads
-- Drop and recreate as PERMISSIVE so either own looks OR public looks can be read
DROP POLICY IF EXISTS "Users can view their own looks" ON public.looks;

CREATE POLICY "Users can view their own looks"
ON public.looks
FOR SELECT
TO public
USING (auth.uid() = user_id);
