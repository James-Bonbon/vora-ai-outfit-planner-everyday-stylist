
ALTER TABLE public.outfit_calendar
  ADD COLUMN IF NOT EXISTS event_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS worn_at timestamptz,
  ADD COLUMN IF NOT EXISTS worn_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outfit_calendar_worn_status_check'
  ) THEN
    ALTER TABLE public.outfit_calendar
      ADD CONSTRAINT outfit_calendar_worn_status_check
      CHECK (worn_status IS NULL OR worn_status IN ('worn','skipped'));
  END IF;
END $$;

ALTER TABLE public.user_calendar_events
  ADD COLUMN IF NOT EXISTS inferred_occasion text;
