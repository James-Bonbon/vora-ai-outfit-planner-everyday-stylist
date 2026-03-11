
-- Allow anyone authenticated to read public, non-reported looks
CREATE POLICY "Anyone can read public looks"
ON public.looks
FOR SELECT
TO authenticated
USING (is_public = true AND reported = false);

-- Allow authenticated users to read any profile (for join in community feed)
CREATE POLICY "Authenticated users can read any profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert reports
CREATE POLICY "Users can insert reports"
ON public.reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Allow authenticated users to read their own reports
CREATE POLICY "Users can read own reports"
ON public.reports
FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- RLS policies for likes table
CREATE POLICY "Users can insert own likes"
ON public.likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
ON public.likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can read likes"
ON public.likes
FOR SELECT
TO authenticated
USING (true);
