ALTER TABLE public.closet_items
ADD COLUMN IF NOT EXISTS image_analysis jsonb,
ADD COLUMN IF NOT EXISTS layout_metadata jsonb;