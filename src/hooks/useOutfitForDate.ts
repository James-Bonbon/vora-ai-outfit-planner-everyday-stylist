/**
 * Shared read/write hook for outfit_calendar entries.
 *
 * Both Home and Calendar must use this hook so they never disagree.
 * Reads use a single query key; mutations invalidate that key.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CalendarSource = "auto_fill" | "home_swap" | "manual" | "saved_look";
export type CalendarStatus = "suggested" | "planned" | "locked";

export interface OutfitCalendarRow {
  id: string;
  user_id: string;
  date: string;
  garment_ids: string[];
  status: CalendarStatus | string;
  source: CalendarSource | string | null;
  occasion: string | null;
  weather_temp: number | null;
  weather_label: string | null;
  weather_code: number | null;
  weather_date: string | null;
  notes: string | null;
  debug_info: any | null;
}

export const outfitCalendarKey = (userId: string | undefined, range: string) =>
  ["outfit-calendar", userId, range] as const;

/** Fetch a date range (inclusive). */
export function useOutfitCalendarRange(startDate: Date, days: number) {
  const { user } = useAuth();
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(addDays(startDate, Math.max(0, days - 1)), "yyyy-MM-dd");

  return useQuery({
    queryKey: outfitCalendarKey(user?.id, `${start}_${end}`),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("outfit_calendar")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", start)
        .lte("date", end)
        .order("date");
      if (error) throw error;
      return (data || []) as OutfitCalendarRow[];
    },
  });
}

export interface UpsertOutfitArgs {
  date: string;
  garmentIds: string[];
  status: CalendarStatus;
  source: CalendarSource;
  occasion?: string | null;
  tempC?: number | null;
  weatherCode?: number | null;
  weatherLabel?: string | null;
  debugInfo?: any;
}

/** Mutation: upsert a calendar row. Invalidates all outfit-calendar queries. */
export function useUpsertOutfit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpsertOutfitArgs) => {
      if (!user) throw new Error("not_authenticated");
      const payload = {
        user_id: user.id,
        date: args.date,
        garment_ids: args.garmentIds,
        status: args.status,
        source: args.source,
        occasion: args.occasion ?? null,
        weather_temp: args.tempC ?? null,
        weather_code: args.weatherCode ?? null,
        weather_label: args.weatherLabel ?? null,
        weather_date: args.date,
        debug_info: args.debugInfo ?? null,
      };
      const { error } = await (supabase as any)
        .from("outfit_calendar")
        .upsert(payload, { onConflict: "user_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outfit-calendar"] });
      qc.invalidateQueries({ queryKey: ["outfit-calendar-data"] });
    },
  });
}

/** Mutation: delete a row. */
export function useDeleteOutfitDate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dateStr: string) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await (supabase as any)
        .from("outfit_calendar")
        .delete()
        .eq("user_id", user.id)
        .eq("date", dateStr);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outfit-calendar"] });
      qc.invalidateQueries({ queryKey: ["outfit-calendar-data"] });
    },
  });
}
