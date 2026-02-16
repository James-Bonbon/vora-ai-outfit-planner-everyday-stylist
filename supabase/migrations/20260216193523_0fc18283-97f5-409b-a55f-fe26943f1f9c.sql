
-- Create beauty_products table
CREATE TABLE public.beauty_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  name TEXT,
  brand TEXT,
  product_type TEXT,
  ingredients TEXT[],
  routine_step TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beauty_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own beauty products"
ON public.beauty_products FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own beauty products"
ON public.beauty_products FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beauty products"
ON public.beauty_products FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beauty products"
ON public.beauty_products FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_beauty_products_updated_at
BEFORE UPDATE ON public.beauty_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
