ALTER TABLE public.dream_items 
ADD COLUMN item_type text NOT NULL DEFAULT 'garment',
ADD COLUMN garments_json jsonb NULL;