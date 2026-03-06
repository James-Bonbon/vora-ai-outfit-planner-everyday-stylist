ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closet_svg text;
ALTER TABLE public.closet_items ADD COLUMN IF NOT EXISTS storage_zone_id text;