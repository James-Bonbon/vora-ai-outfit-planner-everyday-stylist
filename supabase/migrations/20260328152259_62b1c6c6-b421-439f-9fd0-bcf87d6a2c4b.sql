
CREATE TABLE public.user_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_all_day boolean NOT NULL DEFAULT false,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_event_id)
);

ALTER TABLE public.user_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own calendar events"
  ON public.user_calendar_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events"
  ON public.user_calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON public.user_calendar_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON public.user_calendar_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
