CREATE POLICY "Users can update their own looks"
ON public.looks
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);