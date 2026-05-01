import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, format, isToday, getDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Snowflake, Sun, Cloud, CloudRain, RefreshCw, Pencil, Lock, ShirtIcon, Layers, Sparkles, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWeather, weatherCodeToLabel, type ForecastByDate } from "@/hooks/useWeather";
import { getCachedSignedUrls } from "@/utils/signedUrlCache";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";
import { useNavigate } from "react-router-dom";
import {
  countPools,
  MIN_TOPS,
  MIN_BOTTOMS,
  type StylingItem,
} from "@/utils/stylingEngine";
import {
  findNextAcceptableOutfit,
  outfitSignature,
  type ScoredOutfit,
} from "@/utils/outfitScoring";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
}

interface CalendarEntry {
  id: string;
  date: string;
  garment_ids: string[];
  weather_temp: number | null;
  weather_label: string | null;
  weather_code?: number | null;
  weather_date?: string | null;
  occasion: string | null;
  status: string;
  calendar_events?: CalendarEvent[];
}

/** Resolve the temp to use when styling for a specific date. */
function resolveTempForDate(
  dateStr: string,
  forecastByDate: ForecastByDate,
  fallback: number | null | undefined,
): number | null {
  const f = forecastByDate[dateStr];
  if (f && Number.isFinite(f.temp)) return f.temp;
  return fallback ?? null;
}

interface GarmentSnapshot extends StylingItem {}

const WEATHER_ICON: Record<string, typeof Sun> = {
  warm: Sun,
  cool: Snowflake,
  neutral: Cloud,
  rainy: CloudRain,
};

function isWeekend(date: Date) {
  const d = getDay(date);
  return d === 0 || d === 6;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const OutfitCalendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { weather, forecastByDate, loading: weatherLoading } = useWeather();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [garments, setGarments] = useState<Record<string, GarmentSnapshot>>({});
  const [garmentPool, setGarmentPool] = useState<GarmentSnapshot[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [debugAnchors, setDebugAnchors] = useState(false);
  const [upcomingApi, setUpcomingApi] = useState<CarouselApi | null>(null);
  const [upcomingScrollProgress, setUpcomingScrollProgress] = useState(0);

  /* ---- Cached data fetch (React Query hydration pattern) ---- */
  const { data: cachedData, isLoading } = useQuery({
    queryKey: ['outfit-calendar-data', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    refetchOnMount: false,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const end = format(addDays(new Date(), 6), "yyyy-MM-dd");

      const [profileRes, closetRes, roleRes, outfitRes, eventsRes] = await Promise.all([
        supabase.from("profiles").select("subscription_tier").eq("user_id", user!.id).maybeSingle(),
        supabase.from("closet_items").select("id, name, image_url, thumbnail_url, category, created_at, is_in_laundry, image_analysis, layout_metadata").eq("user_id", user!.id),
        supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle(),
        supabase.from("outfit_calendar").select("*").eq("user_id", user!.id).gte("date", today).lte("date", end).order("date"),
        supabase.from("user_calendar_events").select("id, title, start_time, end_time, location").eq("user_id", user!.id).gte("start_time", today + "T00:00:00Z").lte("start_time", end + "T23:59:59Z").order("start_time"),
      ]);

      const pool: GarmentSnapshot[] = [];
      if (closetRes.data && closetRes.data.length > 0) {
        // Prefer thumbnails for calendar previews; fall back to full image for legacy rows.
        const previewPaths = closetRes.data
          .map((it: any) => it.thumbnail_url || it.image_url)
          .filter(Boolean) as string[];
        const urlMap = await getCachedSignedUrls("garments", previewPaths);

        pool.push(...closetRes.data.map((item: any) => {
          const previewPath = item.thumbnail_url || item.image_url;
          return {
            id: item.id,
            name: item.name,
            image_url: urlMap[previewPath] || item.image_url,
            category: item.category,
            created_at: item.created_at,
            is_in_laundry: item.is_in_laundry,
            image_analysis: item.image_analysis,
            layout_metadata: item.layout_metadata,
            source: "closet" as const,
          };
        }));
      }

      return {
        subscriptionTier: profileRes.data?.subscription_tier || "free",
        isAdmin: !!roleRes.data,
        garmentPool: pool,
        entries: outfitRes.data as CalendarEntry[] || [],
        calendarEvents: eventsRes.data as CalendarEvent[] || [],
      };
    }
  });

  /* ---- Resolve garment images for entries that reference items not in the pool ---- */
  useEffect(() => {
    const allIds = entries.flatMap((e) => e.garment_ids || []);
    const unique = [...new Set(allIds)].filter((id) => !garments[id]);
    if (unique.length === 0) return;

    (async () => {
      const { data } = await supabase
        .from("closet_items")
          .select("id, name, image_url, thumbnail_url, category, image_analysis, layout_metadata")
        .in("id", unique);
      if (!data) return;

      const previewPaths = data
        .map((g: any) => g.thumbnail_url || g.image_url)
        .filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", previewPaths);

      const map: Record<string, GarmentSnapshot> = { ...garments };
      for (const g of data as any[]) {
        const path = g.thumbnail_url || g.image_url;
        map[g.id] = {
          ...g,
          image_url: urlMap[path] || g.image_url,
          source: "closet" as const,
        } as GarmentSnapshot;
      }
      setGarments(map);
    })();
  }, [entries, garments]);

  /* ---- Hydrate local state from cached data ---- */
  useEffect(() => {
    if (cachedData) {
      setSubscriptionTier(cachedData.subscriptionTier);
      setIsAdmin(cachedData.isAdmin);
      setGarmentPool(cachedData.garmentPool);
      setEntries(cachedData.entries);
      setCalendarEvents(cachedData.calendarEvents);
    }
  }, [cachedData]);

  /* ---- Pool counts & threshold (via styling engine) ---- */
  const { topsCount, bottomsCount, meetsThreshold } = useMemo(
    () => countPools(garmentPool),
    [garmentPool],
  );

  /* ---- Swap counters per date (deterministic rotation) ---- */
  const [swapCounts, setSwapCounts] = useState<Record<string, number>>({});
  /* ---- Recent outfit signatures per date (last few swaps) to avoid repeats ---- */
  const [recentSignatures, setRecentSignatures] = useState<Record<string, string[]>>({});
  /* ---- Last scored outfit per date — exposed for debug/UI ---- */
  const [scoredByDate, setScoredByDate] = useState<Record<string, {
    scored: ScoredOutfit;
    acceptableCount: number;
    evaluatedCount: number;
    exhausted: boolean;
    fallbackUsed: boolean;
  }>>({});

  /* ---- Get contextual items for a date (uses per-date forecast temp) ---- */
  const getItemsForDate = useCallback(
    (date: Date, entry?: CalendarEntry, dailyEvents?: CalendarEvent[]): GarmentSnapshot[] => {
      if (entry && entry.garment_ids && entry.garment_ids.length > 0) {
        return entry.garment_ids.map((id) => garments[id]).filter(Boolean);
      }
      if (!meetsThreshold) return [];

      const dateStr = format(date, "yyyy-MM-dd");
      const swapOffset = swapCounts[dateStr] || 0;
      const temp = resolveTempForDate(dateStr, forecastByDate, weather?.temp ?? null);

      const occasion = dailyEvents && dailyEvents.length > 0
        ? dailyEvents[0].title
        : entry?.occasion || (isWeekend(date) ? "Casual" : "Smart Casual");

      const wardrobeIsSparse = (topsCount + bottomsCount) < (MIN_TOPS + MIN_BOTTOMS) + 2;

      const result = findNextAcceptableOutfit(garmentPool, {
        date,
        tempC: temp,
        occasion,
        swapCount: swapOffset,
        recentSignatures: recentSignatures[dateStr] || [],
        wardrobeIsSparse,
      });

      if (!result.outfit) return [];

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[OutfitCalendar][score]", {
          date: dateStr,
          score: result.outfit.score,
          band: result.outfit.band,
          passes: result.outfit.passes,
          reasons: result.outfit.reasons,
          warnings: result.outfit.warnings,
          acceptableCount: result.acceptableCount,
          evaluatedCount: result.evaluatedCount,
          fallbackUsed: result.fallbackUsed,
          exhausted: result.exhausted,
          breakdown: result.outfit.breakdown,
        });
      }

      return result.outfit.items as GarmentSnapshot[];
    },
    [garments, garmentPool, meetsThreshold, swapCounts, weather, forecastByDate, recentSignatures, topsCount, bottomsCount],
  );

  /* ---- Swap handler — quality-gated cycle ---- */
  const handleSwap = useCallback(
    (dateStr: string) => {
      if (!meetsThreshold) return;

      const date = new Date(dateStr + "T00:00");
      const dayEvents = calendarEvents.filter((ev) => ev.start_time.startsWith(dateStr));
      const occasion = dayEvents.length > 0 ? dayEvents[0].title : (isWeekend(date) ? "Casual" : "Smart Casual");

      const forecast = forecastByDate[dateStr];
      const tempUsed = forecast?.temp ?? weather?.temp ?? null;
      const codeUsed = forecast?.code ?? weather?.code ?? null;
      const labelUsed = codeUsed != null ? weatherCodeToLabel(codeUsed) : null;

      const newCount = (swapCounts[dateStr] || 0) + 1;
      const wardrobeIsSparse = (topsCount + bottomsCount) < (MIN_TOPS + MIN_BOTTOMS) + 2;

      const result = findNextAcceptableOutfit(garmentPool, {
        date,
        tempC: tempUsed,
        occasion,
        swapCount: newCount,
        recentSignatures: recentSignatures[dateStr] || [],
        wardrobeIsSparse,
      });

      if (!result.outfit) return;

      // Update per-date scoring snapshot for debug/UX
      setScoredByDate((prev) => ({
        ...prev,
        [dateStr]: {
          scored: result.outfit!,
          acceptableCount: result.acceptableCount,
          evaluatedCount: result.evaluatedCount,
          exhausted: result.exhausted,
          fallbackUsed: result.fallbackUsed,
        },
      }));

      setSwapCounts((prev) => ({ ...prev, [dateStr]: newCount }));

      // Track recency (keep last 5 signatures per date)
      const sig = outfitSignature(result.outfit.items);
      setRecentSignatures((prev) => {
        const list = prev[dateStr] || [];
        const next = [sig, ...list.filter((s) => s !== sig)].slice(0, 5);
        return { ...prev, [dateStr]: next };
      });

      const swapped = result.outfit.items as GarmentSnapshot[];
      const map = { ...garments };
      swapped.forEach((g) => (map[g.id] = g as GarmentSnapshot));
      setGarments(map);

      setEntries((prev) => {
        const existing = prev.find((e) => e.date === dateStr);
        if (existing) {
          return prev.map((e) =>
            e.date === dateStr
              ? {
                  ...e,
                  garment_ids: swapped.map((g) => g.id),
                  occasion,
                  weather_temp: tempUsed,
                  weather_code: codeUsed,
                  weather_label: labelUsed,
                  weather_date: dateStr,
                }
              : e,
          );
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            date: dateStr,
            garment_ids: swapped.map((g) => g.id),
            weather_temp: tempUsed,
            weather_label: labelUsed,
            weather_code: codeUsed,
            weather_date: dateStr,
            occasion,
            status: "suggested",
          },
        ];
      });
    },
    [garments, garmentPool, meetsThreshold, swapCounts, weather, forecastByDate, calendarEvents, recentSignatures, topsCount, bottomsCount],
  );

  /* ---- Edit: assign specific item ---- */
  const handleAssignItem = useCallback(
    (item: GarmentSnapshot) => {
      if (!editingDate) return;
      const map = { ...garments, [item.id]: item };
      setGarments(map);

      setEntries((prev) => {
        const existing = prev.find((e) => e.date === editingDate);
        const currentIds = existing?.garment_ids || [];
        const newIds = [...currentIds];
        if (editingSlotIndex < newIds.length) {
          newIds[editingSlotIndex] = item.id;
        } else {
          newIds.push(item.id);
        }

        if (existing) {
          return prev.map((e) => (e.date === editingDate ? { ...e, garment_ids: newIds } : e));
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            date: editingDate,
            garment_ids: newIds,
            weather_temp: null,
            weather_label: null,
            occasion: null,
            status: "planned",
          },
        ];
      });
      setDrawerOpen(false);
    },
    [editingDate, editingSlotIndex, garments],
  );

  /* ---- Build day slots ---- */
  const hasProAccess = subscriptionTier === "pro" || isAdmin;
  const maxDays = hasProAccess ? 7 : 3;

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const entry = entries.find((e) => e.date === dateStr);
      const dayEvents = calendarEvents.filter((ev) => ev.start_time.startsWith(dateStr));
      return { date, dateStr, entry, isToday: isToday(date), calendarEvents: dayEvents };
    });
  }, [entries, calendarEvents]);

  const visibleUpcoming = days.slice(1, maxDays);
  const showLockedCard = !hasProAccess;
  const upcomingItemCount = visibleUpcoming.length + (showLockedCard ? 1 : 0);

  const updateUpcomingProgress = useCallback((api: CarouselApi) => {
    if (!api) return;
    const progress = Math.max(0, Math.min(1, api.scrollProgress()));
    setUpcomingScrollProgress(progress);
  }, []);

  useEffect(() => {
    if (!upcomingApi) return;

    updateUpcomingProgress(upcomingApi);
    upcomingApi.on("scroll", updateUpcomingProgress);
    upcomingApi.on("select", updateUpcomingProgress);
    upcomingApi.on("reInit", updateUpcomingProgress);

    return () => {
      upcomingApi.off("scroll", updateUpcomingProgress);
      upcomingApi.off("select", updateUpcomingProgress);
      upcomingApi.off("reInit", updateUpcomingProgress);
    };
  }, [upcomingApi, updateUpcomingProgress]);

  /* ---- LOCKED STATE: Not enough items ---- */
  if (!isLoading && !meetsThreshold) {
    return (
      <GlassCard className="p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground font-outfit">Unlock Your Daily Stylist</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add at least 7 Tops and 3 Bottoms to your Wardrobe or Wishlist to activate the Outfit Calendar.
          </p>
        </div>
        <div className="space-y-3 max-w-[260px] mx-auto">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <ShirtIcon className="w-3 h-3" /> Tops
              </span>
              <span className="font-semibold text-foreground">
                {topsCount}/{MIN_TOPS}
              </span>
            </div>
            <Progress value={(topsCount / MIN_TOPS) * 100} className="h-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" /> Bottoms
              </span>
              <span className="font-semibold text-foreground">
                {bottomsCount}/{MIN_BOTTOMS}
              </span>
            </div>
            <Progress value={(bottomsCount / MIN_BOTTOMS) * 100} className="h-2" />
          </div>
        </div>
      </GlassCard>
    );
  }

  if (isLoading && garmentPool.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
      </GlassCard>
    );
  }

  const todaySlot = days[0];
  const todayGarments = getItemsForDate(todaySlot.date, todaySlot.entry, todaySlot.calendarEvents);
  const WeatherIconComp = WEATHER_ICON[todaySlot.entry?.weather_label || "neutral"] || Cloud;
  const tempDisplay = todaySlot.entry?.weather_temp ? `${Math.round(todaySlot.entry.weather_temp)}°C` : "";
  const todayOccasion = todaySlot.calendarEvents.length > 0
    ? todaySlot.calendarEvents[0].title
    : todaySlot.entry?.occasion || (isWeekend(todaySlot.date) ? "Casual" : "Smart Casual");

  /* ---- Compute & cache today's score for debug panel / exhausted UI ---- */
  useEffect(() => {
    if (!meetsThreshold) return;
    if (todaySlot.entry?.garment_ids?.length) return; // user-edited override, no score
    const dateStr = todaySlot.dateStr;
    const temp = resolveTempForDate(dateStr, forecastByDate, weather?.temp ?? null);
    const wardrobeIsSparse = (topsCount + bottomsCount) < (MIN_TOPS + MIN_BOTTOMS) + 2;
    const result = findNextAcceptableOutfit(garmentPool, {
      date: todaySlot.date,
      tempC: temp,
      occasion: todayOccasion,
      swapCount: swapCounts[dateStr] || 0,
      recentSignatures: recentSignatures[dateStr] || [],
      wardrobeIsSparse,
    });
    if (!result.outfit) return;
    setScoredByDate((prev) => {
      const existing = prev[dateStr];
      if (existing && existing.scored.score === result.outfit!.score && existing.exhausted === result.exhausted) {
        return prev;
      }
      return {
        ...prev,
        [dateStr]: {
          scored: result.outfit!,
          acceptableCount: result.acceptableCount,
          evaluatedCount: result.evaluatedCount,
          exhausted: result.exhausted,
          fallbackUsed: result.fallbackUsed,
        },
      };
    });
  }, [todaySlot, todayOccasion, garmentPool, meetsThreshold, swapCounts, recentSignatures, forecastByDate, weather, topsCount, bottomsCount]);


  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="rounded-2xl glass-card p-4">
        {import.meta.env.DEV && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] font-medium text-foreground">
              <Bug className="h-3.5 w-3.5 text-primary" /> Outfit debug overlay
            </span>
            <Switch checked={debugAnchors} onCheckedChange={setDebugAnchors} aria-label="Toggle outfit debug overlay" />
          </div>
        )}
        {/* ===== TODAY'S OUTFIT CARD ===== */}
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
              Today
            </span>
            <WeatherWidget weather={weather} loading={weatherLoading} />
            {!weather && tempDisplay && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground text-[11px] font-medium">
                <WeatherIconComp className="w-3.5 h-3.5" />
                {tempDisplay}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
              {todayOccasion}
            </span>
          </div>

          {/* Outfit Collage Display */}
          {todayGarments.length > 0 ? (
            <div className="space-y-3">
              <OutfitCollage garments={todayGarments} debugAnchors={debugAnchors} />
              <Button
                className="w-full rounded-xl gap-2"
                onClick={() => {
                  // Navigate to AI Stylist with garments pre-selected
                  navigate("/mirror", {
                    state: {
                      preSelectedIds: todayGarments.map((g) => g.id),
                      vibe: todayOccasion,
                    },
                  });
                }}
              >
                <Sparkles className="w-4 h-4" />
                See it on me
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 justify-center py-4">
              <div className="w-20 h-24 rounded-xl bg-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Top</span>
              </div>
              <div className="w-20 h-24 rounded-xl bg-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Bottom</span>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4 mt-4 pt-2 w-full">
            <Button
              size="sm"
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-4"
              onClick={() => handleSwap(todaySlot.dateStr)}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Swap
            </Button>
            <DrawerTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-primary text-primary hover:bg-primary/10 text-xs h-8 px-4"
                onClick={() => {
                  setEditingDate(todaySlot.dateStr);
                  setEditingSlotIndex(0);
                }}
              >
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            </DrawerTrigger>
          </div>

          {/* Exhausted message — no more strong matches */}
          {scoredByDate[todaySlot.dateStr]?.exhausted && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground italic">
              No more strong matches today — looping through your best picks.
            </p>
          )}

          {/* Debug score panel */}
          {import.meta.env.DEV && scoredByDate[todaySlot.dateStr] && (() => {
            const s = scoredByDate[todaySlot.dateStr];
            const o = s.scored;
            return (
              <div className="mt-3 rounded-xl border border-border bg-muted/40 p-2.5 text-[10px] leading-relaxed text-foreground space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Outfit score</span>
                  <span className="font-mono">{o.score} · {o.band}</span>
                </div>
                <div>Threshold: {o.passes ? "PASS (≥70)" : s.fallbackUsed ? "FALLBACK" : "FAIL"}</div>
                <div>Top reasons: {o.reasons.join(", ")}</div>
                {o.warnings.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">⚠ {o.warnings.join(" · ")}</div>
                )}
                <div className="text-muted-foreground">
                  Acceptable {s.acceptableCount}/{s.evaluatedCount} candidates
                </div>
              </div>
            );
          })()}

          <div className="mt-4 pt-3 border-t border-border text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {todaySlot.entry ? "Planned Outfit" : "Suggested Outfit"}
            </span>
          </div>
        </div>

        {/* ===== UPCOMING DAYS CAROUSEL ===== */}
        {visibleUpcoming.length > 0 && (
          <Carousel opts={{ align: "start", dragFree: true }} setApi={setUpcomingApi} className="w-full">
            <CarouselContent className="-ml-2">
              {visibleUpcoming.map((slot) => {
                const slotGarments = getItemsForDate(slot.date, slot.entry, slot.calendarEvents);
                const occasion = slot.calendarEvents.length > 0
                  ? slot.calendarEvents[0].title
                  : slot.entry?.occasion || (isWeekend(slot.date) ? "Casual" : "Office");
                const slotForecast = forecastByDate[slot.dateStr];
                const slotTemp =
                  slot.entry?.weather_temp ?? slotForecast?.temp ?? null;
                const SlotWeatherIcon =
                  WEATHER_ICON[
                    slot.entry?.weather_label ||
                      (slotForecast ? weatherCodeToLabel(slotForecast.code) : "neutral")
                  ] || Cloud;

                return (
                  <CarouselItem key={slot.dateStr} className="pl-2 basis-[55%] sm:basis-[42%]">
                    <div className="rounded-2xl bg-card border border-border p-3">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-bold text-foreground font-outfit">{format(slot.date, "EEE d")}</p>
                        {slotTemp != null && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-foreground text-[9px] font-medium">
                            <SlotWeatherIcon className="w-2.5 h-2.5" />
                            {Math.round(slotTemp)}°
                          </span>
                        )}
                      </div>
                      <span className="block mt-0.5 text-[9px] text-muted-foreground capitalize truncate">{occasion}</span>

                      <div className="mt-2">
                        {slotGarments.length > 0 ? (
                          <OutfitCollage garments={slotGarments} debugAnchors={debugAnchors} />
                        ) : (
                          <div className="aspect-[3/4] rounded-2xl bg-muted" />
                        )}
                      </div>

                      <div className="mt-2 space-y-0.5">
                        {slotGarments.length > 0 ? (
                          slotGarments.slice(0, 2).map((g) => (
                            <p key={g.id} className="text-[11px] text-foreground truncate">
                              {g.name || g.category || "Garment"}
                            </p>
                          ))
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">Empty</p>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-border text-center">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                          {slot.entry ? "Planned" : "Suggested"}
                        </span>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}

              {showLockedCard && (
                <CarouselItem className="pl-2 basis-[55%] sm:basis-[42%]">
                  <div className="rounded-2xl bg-card border border-border p-3 flex flex-col items-center justify-center h-full min-h-[160px] opacity-70">
                    <Lock className="w-6 h-6 text-primary mb-2" />
                    <p className="text-[11px] text-muted-foreground text-center leading-tight">
                      Upgrade to <span className="text-primary font-semibold">Pro</span> to plan 7 days ahead
                    </p>
                  </div>
                </CarouselItem>
              )}
            </CarouselContent>

            <div className="mt-3 flex justify-center">
              <div
                className="relative h-1 w-28 rounded-full bg-border"
                role="progressbar"
                aria-label="Upcoming outfits carousel progress"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, upcomingItemCount - 1)}
                aria-valuenow={Math.round(upcomingScrollProgress * Math.max(0, upcomingItemCount - 1))}
              >
                <span
                  className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary transition-transform duration-75 ease-out"
                  style={{ transform: `translate(${upcomingScrollProgress * 102}px, -50%)` }}
                />
              </div>
            </div>
          </Carousel>
        )}
      </div>

      {/* ===== EDIT DRAWER ===== */}
      <DrawerContent className="bg-card border-border">
        <DrawerHeader>
          <DrawerTitle className="text-foreground font-outfit">
            Pick an item for {editingDate ? format(new Date(editingDate + "T00:00"), "EEE, MMM d") : ""}
          </DrawerTitle>
        </DrawerHeader>
        {/* Slot selector */}
        {editingDate && (
          <div className="flex justify-center gap-2 mb-4 px-4">
            {getItemsForDate(new Date(editingDate + "T00:00"), undefined, calendarEvents.filter(ev => ev.start_time.startsWith(editingDate))).map((g, idx) => (
              <Button
                key={idx}
                variant={editingSlotIndex === idx ? "default" : "outline"}
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setEditingSlotIndex(idx)}
              >
                Replace {g.category || g.name || `Item ${idx + 1}`}
              </Button>
            ))}
          </div>
        )}
        <div className="px-4 pb-6 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {garmentPool.map((item) => (
            <button
              key={item.id}
              className="rounded-xl overflow-hidden bg-muted border border-border hover:border-primary transition-colors"
              onClick={() => handleAssignItem(item)}
            >
              <div className="aspect-[3/4]">
                <SafeImage
                  src={item.image_url}
                  alt={item.name || "Item"}
                  aspectRatio=""
                  wrapperClassName="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-foreground p-1.5 truncate">{item.name || item.category || "Item"}</p>
            </button>
          ))}
          {garmentPool.length === 0 && (
            <p className="col-span-3 text-center text-sm text-muted-foreground py-8">
              No items available. Add garments to your wardrobe first.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OutfitCalendar;
