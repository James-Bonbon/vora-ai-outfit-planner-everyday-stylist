ALTER TABLE public.outfit_calendar
  ADD COLUMN IF NOT EXISTS weather_code INTEGER,
  ADD COLUMN IF NOT EXISTS weather_date DATE;