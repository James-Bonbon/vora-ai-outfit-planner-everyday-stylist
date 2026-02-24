
CREATE TABLE public.outfit_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  garment_ids UUID[] DEFAULT '{}'::uuid[],
  weather_temp NUMERIC,
  weather_label TEXT,
  occasion TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one entry per user per date
ALTER TABLE public.outfit_calendar ADD CONSTRAINT outfit_calendar_user_date_unique UNIQUE (user_id, date);

-- Enable RLS
ALTER TABLE public.outfit_calendar ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own outfit calendar" ON public.outfit_calendar FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own outfit calendar" ON public.outfit_calendar FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own outfit calendar" ON public.outfit_calendar FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own outfit calendar" ON public.outfit_calendar FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_outfit_calendar_updated_at BEFORE UPDATE ON public.outfit_calendar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
