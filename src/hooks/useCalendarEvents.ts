/**
 * Shared hook for user_calendar_events.
 *
 * Groups events by the user's LOCAL-TIMEZONE date (not UTC) so a 23:00 local
 * event always attaches to the correct local day.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, eachDayOfInterval, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { inferOccasion, dominantOccasion, type InferredOccasion } from "@/utils/planner/inferOccasion";

export interface CalendarEventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  is_all_day: boolean;
  inferred_occasion: InferredOccasion | null;
}

export interface EventWithOccasion extends CalendarEventRow {
  occasion: InferredOccasion;
}

export function useCalendarEventsRange(startDate: Date, days: number) {
  const { user } = useAuth();
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(addDays(startDate, Math.max(0, days - 1)), "yyyy-MM-dd");

  const query = useQuery({
    queryKey: ["calendar-events-range", user?.id, start, end],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_calendar_events")
        .select("id, title, start_time, end_time, location, is_all_day, inferred_occasion")
        .eq("user_id", user!.id)
        .gte("start_time", `${start}T00:00:00.000Z`)
        // pad end window by a day to capture multi-day events
        .lte("start_time", `${format(addDays(new Date(end), 1), "yyyy-MM-dd")}T23:59:59.999Z`)
        .order("start_time");
      if (error) throw error;
      return (data || []) as CalendarEventRow[];
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, EventWithOccasion[]>();
    for (const ev of query.data || []) {
      const occ: InferredOccasion = ev.inferred_occasion ?? inferOccasion(ev);
      const start = startOfDay(new Date(ev.start_time));
      const end = startOfDay(new Date(ev.end_time));
      const days = eachDayOfInterval({ start, end });
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ ...ev, occasion: occ });
      }
    }
    return map;
  }, [query.data]);

  const eventsForDate = (dateStr: string): EventWithOccasion[] => byDate.get(dateStr) || [];
  const occasionForDate = (dateStr: string): InferredOccasion | null =>
    dominantOccasion(eventsForDate(dateStr).map((e) => e.occasion));

  // Background: persist inferred_occasion for events missing it
  useMemo(() => {
    if (!user || !query.data) return;
    const stale = query.data.filter((e) => !e.inferred_occasion);
    if (stale.length === 0) return;
    void (async () => {
      for (const ev of stale) {
        const occ = inferOccasion(ev);
        await supabase
          .from("user_calendar_events")
          .update({ inferred_occasion: occ })
          .eq("id", ev.id);
      }
    })();
  }, [user, query.data]);

  return {
    ...query,
    events: query.data || [],
    byDate,
    eventsForDate,
    occasionForDate,
  };
}
