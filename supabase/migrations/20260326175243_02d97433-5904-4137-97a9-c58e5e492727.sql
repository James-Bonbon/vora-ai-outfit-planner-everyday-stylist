
-- Create feed_images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('feed_images', 'feed_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload feed images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feed_images');

-- Anyone can read feed images
CREATE POLICY "Anyone can read feed images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'feed_images');

-- Users can delete their own feed images
CREATE POLICY "Users can delete own feed images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feed_images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create feed_posts table
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  image_url text NOT NULL,
  description text NOT NULL DEFAULT '',
  outfit_breakdown jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

-- Insert: authenticated users can insert their own posts
CREATE POLICY "Users can insert own feed posts"
ON public.feed_posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Select: approved posts visible to all authenticated, or own posts
CREATE POLICY "Users can read approved or own feed posts"
ON public.feed_posts FOR SELECT TO authenticated
USING (status = 'approved' OR auth.uid() = user_id);

-- Delete: users can delete their own posts
CREATE POLICY "Users can delete own feed posts"
ON public.feed_posts FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Update: allow service role updates (for moderation edge function)
-- No user-facing update policy needed
