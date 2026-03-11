
-- Add foreign key from looks.user_id to profiles.user_id to enable PostgREST joins
ALTER TABLE public.looks
ADD CONSTRAINT looks_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);
