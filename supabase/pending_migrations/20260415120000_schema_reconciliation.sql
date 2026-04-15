-- ============================================================
-- Phase 4A: Schema Reconciliation Migration
-- File: 20260415120000_schema_reconciliation.sql
-- Idempotent — safe to run on databases where objects already exist.
-- DO NOT EXECUTE without reviewing against live schema first.
-- ============================================================

-- ── 1. likes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  look_id uuid,
  created_at timestamptz NOT NULL DEFAULT (timezone('utc', now()))
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'likes_look_id_fkey'
      AND table_schema = 'public' AND table_name = 'likes'
  ) THEN
    ALTER TABLE public.likes
      ADD CONSTRAINT likes_look_id_fkey FOREIGN KEY (look_id) REFERENCES public.looks(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_look ON public.likes (user_id, look_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='likes' AND policyname='Users can read likes') THEN
    CREATE POLICY "Users can read likes" ON public.likes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='likes' AND policyname='Users can insert own likes') THEN
    CREATE POLICY "Users can insert own likes" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='likes' AND policyname='Users can delete own likes') THEN
    CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. reports ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  look_id uuid,
  reporter_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT (timezone('utc', now()))
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reports_look_id_fkey'
      AND table_schema = 'public' AND table_name = 'reports'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_look_id_fkey FOREIGN KEY (look_id) REFERENCES public.looks(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users can insert reports') THEN
    CREATE POLICY "Users can insert reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='Users can read own reports') THEN
    CREATE POLICY "Users can read own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
  END IF;
END $$;

-- ── 3. lookbook_outfits ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lookbook_outfits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  garment_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lookbook_outfits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lookbook_outfits' AND policyname='Users can manage their own lookbook') THEN
    CREATE POLICY "Users can manage their own lookbook" ON public.lookbook_outfits FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. planned_outfits ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planned_outfits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lookbook_id uuid NOT NULL,
  planned_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planned_outfits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'planned_outfits_lookbook_id_fkey'
      AND table_schema = 'public' AND table_name = 'planned_outfits'
  ) THEN
    ALTER TABLE public.planned_outfits
      ADD CONSTRAINT planned_outfits_lookbook_id_fkey FOREIGN KEY (lookbook_id) REFERENCES public.lookbook_outfits(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='planned_outfits' AND policyname='Users can manage their own planned outfits') THEN
    CREATE POLICY "Users can manage their own planned outfits" ON public.planned_outfits FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 5. wardrobes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wardrobes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  title text NOT NULL,
  created_at timestamptz DEFAULT (timezone('utc', now()))
);

ALTER TABLE public.wardrobes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wardrobes' AND policyname='Users view own wardrobes') THEN
    CREATE POLICY "Users view own wardrobes" ON public.wardrobes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. wardrobe_views ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wardrobe_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wardrobe_id uuid,
  name text NOT NULL,
  image_url text NOT NULL,
  svg_string text,
  created_at timestamptz DEFAULT (timezone('utc', now()))
);

ALTER TABLE public.wardrobe_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wardrobe_views_wardrobe_id_fkey'
      AND table_schema = 'public' AND table_name = 'wardrobe_views'
  ) THEN
    ALTER TABLE public.wardrobe_views
      ADD CONSTRAINT wardrobe_views_wardrobe_id_fkey FOREIGN KEY (wardrobe_id) REFERENCES public.wardrobes(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wardrobe_views' AND policyname='Users view own wardrobe views') THEN
    CREATE POLICY "Users view own wardrobe views" ON public.wardrobe_views FOR SELECT
      USING (wardrobe_id IN (SELECT id FROM public.wardrobes WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── 7. looks – add missing columns ─────────────────────────
ALTER TABLE public.looks ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE public.looks ADD COLUMN IF NOT EXISTS reported boolean DEFAULT false;
ALTER TABLE public.looks ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE public.looks ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'looks_user_id_profiles_fkey'
      AND table_schema = 'public' AND table_name = 'looks'
  ) THEN
    ALTER TABLE public.looks
      ADD CONSTRAINT looks_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_looks_public_featured ON public.looks (is_public, is_featured) WHERE is_public = true AND reported = false;

-- ── 8. feed_posts – foreign key ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'feed_posts_user_id_fkey'
      AND table_schema = 'public' AND table_name = 'feed_posts'
  ) THEN
    ALTER TABLE public.feed_posts
      ADD CONSTRAINT feed_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 9. Username uniqueness (case-insensitive, null-safe) ────
-- NOTE: If duplicate usernames exist, this will fail.
-- Find duplicates first:
--   SELECT lower(username), count(*) FROM profiles
--   WHERE username IS NOT NULL GROUP BY lower(username) HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- ── 10. Useful indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_closet_items_user ON public.closet_items (user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON public.feed_posts (status) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_outfit_calendar_user_date ON public.outfit_calendar (user_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_products_user ON public.beauty_products (user_id);
CREATE INDEX IF NOT EXISTS idx_dream_items_user ON public.dream_items (user_id);
CREATE INDEX IF NOT EXISTS idx_lookbook_outfits_user ON public.lookbook_outfits (user_id);
CREATE INDEX IF NOT EXISTS idx_planned_outfits_user ON public.planned_outfits (user_id);
CREATE INDEX IF NOT EXISTS idx_likes_look ON public.likes (look_id);
