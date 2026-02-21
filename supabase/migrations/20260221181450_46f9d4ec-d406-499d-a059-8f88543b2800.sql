
CREATE TABLE public.trending_clothes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  brand text,
  price text,
  image_url text,
  product_link text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trending_clothes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trending clothes"
ON public.trending_clothes
FOR SELECT
USING (true);
