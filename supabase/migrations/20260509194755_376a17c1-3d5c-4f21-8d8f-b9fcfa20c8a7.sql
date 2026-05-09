ALTER TABLE public.outfit_calendar
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS debug_info jsonb;

CREATE INDEX IF NOT EXISTS idx_outfit_calendar_user_date
  ON public.outfit_calendar (user_id, date);