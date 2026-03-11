
-- Drop the restrictive own-profile policy and replace with a permissive one
-- so that the new "any profile" policy can also work
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate as permissive (default) so users can still read their own profile
-- The "Authenticated users can read any profile" policy covers community feed reads
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO public
USING (auth.uid() = user_id);
