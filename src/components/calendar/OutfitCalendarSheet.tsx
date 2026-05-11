import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format, addDays, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addMonths, isSameDay, isSameMonth, getDay, differenceInCalendarDays,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Sparkles, Calendar as CalendarIcon, Loader2, Shirt, Wand2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ignoreToastInteractOutside } from "@/lib/radixToastGuard";
import { getCachedSignedUrls } from "@/utils/signedUrlCache";
import { useWeather, weatherCodeToLabel } from "@/hooks/useWeather";
import {
  useOutfitCalendarRange,
  useUpsertOutfit,
  useDeleteOutfitDate,
  type OutfitCalendarRow,
} from "@/hooks/useOutfitForDate";
import { useCalendarEventsRange } from "@/hooks/useCalendarEvents";
import { autoFillRange } from "@/utils/planner/autoFillRange";
import { suggestOutfitForDate } from "@/utils/planner/suggestOutfit";
import DatePlannerCard, { type DateKind } from "./DatePlannerCard";
import MonthDateCell from "./MonthDateCell";
import type { StylingItem } from "@/utils/stylingEngine";
import type { OutfitHistoryEntry } from "@/utils/outfitScoring";

const WEEK_DAYS = 7;

function isWeekend(d: Date) {
  const w = getDay(d);
  return w === 0 || w === 6;
}

function classifyDate(d: Date, today: Date): DateKind {
  if (isSameDay(d, today)) return "today";
  return d < today ? "past" : "future";
}

export const OutfitCalendarSheet = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = startOfToday();
  const { weather, forecastByDate } = useWeather();

  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  // Monday of the visible week (local TZ).
  const [viewStart, setViewStart] = useState<Date>(() => startOfWeek(today, { weekStartsOn: 1 }));
  const isCurrentWeek = isSameDay(viewStart, startOfWeek(today, { weekStartsOn: 1 }));
  const viewEnd = addDays(viewStart, WEEK_DAYS - 1);
  const todayStr = format(today, "yyyy-MM-dd");
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() =>
    isCurrentWeek ? todayStr : format(viewStart, "yyyy-MM-dd"),
  );

  // Keep selected date inside the visible week.
  useEffect(() => {
    const startStr = format(viewStart, "yyyy-MM-dd");
    const endStr = format(viewEnd, "yyyy-MM-dd");
    if (selectedDateStr < startStr || selectedDateStr > endStr) {
      const todayInWeek = todayStr >= startStr && todayStr <= endStr;
      setSelectedDateStr(todayInWeek ? todayStr : startStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStart]);

  const { eventsForDate, occasionForDate } = useCalendarEventsRange(viewStart, WEEK_DAYS);

  // Wardrobe + history (lightweight; only when sheet is open)
  const { data: wardrobeData } = useQuery({
    queryKey: ["planner-wardrobe", user?.id],
    enabled: !!user && isOpen,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const todayStr = format(today, "yyyy-MM-dd");
      const historyStart = format(addDays(today, -14), "yyyy-MM-dd");
      const [closetRes, historyRes] = await Promise.all([
        supabase.from("closet_items")
          .select("id, name, image_url, thumbnail_url, category, created_at, is_in_laundry, image_analysis, layout_metadata")
          .eq("user_id", user!.id),
        supabase.from("outfit_calendar")
          .select("date, garment_ids")
          .eq("user_id", user!.id)
          .gte("date", historyStart)
          .lt("date", todayStr),
      ]);

      const items = closetRes.data || [];
      const previewPaths = items.map((it: any) => it.thumbnail_url || it.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", previewPaths);
      const wardrobe: StylingItem[] = items.map((it: any) => ({
        id: it.id,
        name: it.name,
        image_url: urlMap[it.thumbnail_url || it.image_url] || it.image_url,
        category: it.category,
        created_at: it.created_at,
        is_in_laundry: it.is_in_laundry,
        image_analysis: it.image_analysis,
        layout_metadata: it.layout_metadata,
        source: "closet" as const,
      }));

      const history: OutfitHistoryEntry[] = (historyRes.data || [])
        .filter((r: any) => Array.isArray(r.garment_ids) && r.garment_ids.length > 0)
        .map((r: any) => ({ date: r.date, garmentIds: r.garment_ids }));

      return { wardrobe, history };
    },
  });

  const wardrobe = wardrobeData?.wardrobe || [];
  const pastHistory = wardrobeData?.history || [];

  // Calendar entries for the visible range (week)
  const { data: rows = [], isLoading: rowsLoading } = useOutfitCalendarRange(viewStart, WEEK_DAYS);

  // Resolve garments referenced by entries (for cards)
  const [garmentMap, setGarmentMap] = useState<Record<string, StylingItem>>({});
  useEffect(() => {
    const fromWardrobe: Record<string, StylingItem> = {};
    for (const g of wardrobe) fromWardrobe[g.id] = g;
    const allIds = rows.flatMap((r) => r.garment_ids || []);
    const missing = [...new Set(allIds)].filter((id) => !fromWardrobe[id] && !garmentMap[id]);
    if (missing.length === 0) {
      setGarmentMap((prev) => ({ ...fromWardrobe, ...prev }));
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("closet_items")
        .select("id, name, image_url, thumbnail_url, category, image_analysis, layout_metadata")
        .in("id", missing);
      const paths = (data || []).map((g: any) => g.thumbnail_url || g.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", paths);
      const next: Record<string, StylingItem> = { ...fromWardrobe, ...garmentMap };
      for (const g of data || []) {
        next[(g as any).id] = {
          ...(g as any),
          image_url: urlMap[(g as any).thumbnail_url || (g as any).image_url] || (g as any).image_url,
          source: "closet",
        } as StylingItem;
      }
      setGarmentMap(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, wardrobe]);

  // Build day list with resolved items
  const days = useMemo(() => {
    const rowsByDate = new Map(rows.map((r) => [r.date, r]));
    return Array.from({ length: WEEK_DAYS }, (_, i) => {
      const date = addDays(viewStart, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dateKind = classifyDate(date, today);
      const row = rowsByDate.get(dateStr);
      const forecast = forecastByDate[dateStr];
      const tempC = row?.weather_temp ?? forecast?.temp ?? null;
      const weatherLabel = row?.weather_label ?? (forecast ? weatherCodeToLabel(forecast.code) : null);
      const events = eventsForDate(dateStr);
      const eventOccasion = occasionForDate(dateStr);
      const occasion = row?.occasion ?? eventOccasion ?? (isWeekend(date) ? "Casual" : "Smart Casual");
      let items: StylingItem[] = (row?.garment_ids || []).map((id) => garmentMap[id]).filter(Boolean) as StylingItem[];
      let emptyReason: "wardrobe_too_small" | "no_match" | null = null;

      // Future / today: ephemeral local suggestion when no row.
      // Past: NEVER auto-generate.
      if (!row && dateKind !== "past" && wardrobe.length > 0) {
        const sug = suggestOutfitForDate({
          date, wardrobe, tempC, occasion,
          events,
          history: pastHistory,
        });
        if (sug.ok) items = sug.items;
        else emptyReason = sug.reason || "no_match";
      }
      return { date, dateStr, dateKind, row, items, tempC, weatherLabel, occasion, emptyReason, events };
    });
  }, [rows, garmentMap, wardrobe, viewStart, today, forecastByDate, pastHistory, eventsForDate, occasionForDate]);

  // Mutations
  const upsert = useUpsertOutfit();
  const del = useDeleteOutfitDate();

  const upsertSync = useCallback(async (args: Parameters<typeof upsert.mutateAsync>[0]) => {
    await upsert.mutateAsync(args);
  }, [upsert]);

  // Auto-fill week
  const handleAutoFill = useCallback(async (replaceSuggestions = false) => {
    if (!user) return;
    if (wardrobe.length === 0) {
      toast.error("Add items to your closet first.");
      return;
    }
    setAutoFilling(true);
    try {
      const contextByDate: Record<string, any> = {};
      for (const d of days) {
        contextByDate[d.dateStr] = {
          tempC: d.tempC,
          occasion: d.occasion,
          events: d.events.map((e) => ({ id: e.id, occasion: e.occasion })),
        };
      }
      const existing = rows.map((r) => ({
        id: r.id, date: r.date, garment_ids: r.garment_ids, status: r.status, source: r.source,
      }));
      // Auto-fill operates on the visible week, but autoFillRange itself
      // skips any past date. So pass viewStart + WEEK_DAYS and let it filter.
      const result = await autoFillRange({
        userId: user.id,
        startDate: viewStart,
        days: WEEK_DAYS,
        wardrobe,
        contextByDate,
        existing,
        pastHistory,
        replaceSuggestions,
        onProgress: () => {
          queryClient.invalidateQueries({ queryKey: ["outfit-calendar"] });
        },
        onAIRefined: () => {
          queryClient.invalidateQueries({ queryKey: ["outfit-calendar"] });
        },
      });
      queryClient.invalidateQueries({ queryKey: ["outfit-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["outfit-calendar-data"] });
      if (result.filled.length === 0 && result.skipped.length > 0) {
        toast.info("Nothing to auto-fill — week is already planned or in the past.");
      } else {
        toast.success(`Auto-filled ${result.filled.length} day${result.filled.length === 1 ? "" : "s"}.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Auto-fill failed.");
    } finally {
      setAutoFilling(false);
    }
  }, [user, wardrobe, days, rows, pastHistory, viewStart, queryClient]);

  // Per-card actions
  const handleSwap = useCallback(async (dateStr: string) => {
    setBusyDate(dateStr);
    try {
      const day = days.find((d) => d.dateStr === dateStr);
      if (!day) return;
      const recent = day.items.length > 0 ? [[...day.items.map((i) => i.id)].sort().join("|")] : [];
      // Try several swap counts to find a different outfit
      let swap = 1;
      let chosen = null;
      for (; swap < 12; swap++) {
        const sug = suggestOutfitForDate({
          date: day.date, wardrobe, tempC: day.tempC, occasion: day.occasion,
          swapCount: swap, recentSignatures: recent, history: pastHistory,
        });
        if (sug.ok && sug.signature && !recent.includes(sug.signature)) {
          chosen = sug;
          break;
        }
      }
      if (!chosen?.ok) {
        toast.info("No more strong matches.");
        return;
      }
      await upsertSync({
        date: dateStr,
        garmentIds: chosen.items.map((i) => i.id),
        status: day.row?.status === "planned" ? "planned" : "suggested",
        source: "manual",
        occasion: day.occasion,
        tempC: day.tempC,
        weatherLabel: day.weatherLabel,
        debugInfo: chosen.scored ? {
          score: chosen.scored.score, band: chosen.scored.band,
          reasons: chosen.scored.reasons, ai_status: "fallback",
        } : null,
      });
    } finally {
      setBusyDate(null);
    }
  }, [days, wardrobe, pastHistory, upsertSync]);

  const handleSave = useCallback(async (dateStr: string) => {
    const day = days.find((d) => d.dateStr === dateStr);
    if (!day || day.items.length === 0) return;
    setBusyDate(dateStr);
    try {
      await upsertSync({
        date: dateStr,
        garmentIds: day.items.map((i) => i.id),
        status: "planned",
        source: "manual",
        occasion: day.occasion,
        tempC: day.tempC,
        weatherLabel: day.weatherLabel,
      });
      toast.success("Outfit planned.");
    } finally {
      setBusyDate(null);
    }
  }, [days, upsertSync]);

  const handleToggleLock = useCallback(async (dateStr: string) => {
    const day = days.find((d) => d.dateStr === dateStr);
    if (!day || day.items.length === 0) return;
    setBusyDate(dateStr);
    try {
      const isLocked = day.row?.status === "locked";
      await upsertSync({
        date: dateStr,
        garmentIds: day.items.map((i) => i.id),
        status: isLocked ? "planned" : "locked",
        source: day.row?.source as any || "manual",
        occasion: day.occasion,
        tempC: day.tempC,
        weatherLabel: day.weatherLabel,
      });
    } finally {
      setBusyDate(null);
    }
  }, [days, upsertSync]);

  // Saved Looks picker (drawer)
  const { data: lookbook = [], isLoading: isLoadingLookbook } = useQuery({
    queryKey: ["lookbook-with-garments", user?.id],
    enabled: !!user && !!pickerDate,
    queryFn: async () => {
      const { data: outfits } = await supabase.from("lookbook_outfits").select("*").eq("user_id", user!.id);
      if (!outfits || outfits.length === 0) return [];
      const allIds = Array.from(new Set(outfits.flatMap((o: any) => o.garment_ids || [])));
      const { data: items } = await supabase
        .from("closet_items")
        .select("id, name, category, image_url, thumbnail_url")
        .in("id", allIds);
      const paths = (items || []).map((g: any) => g.thumbnail_url || g.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", paths);
      const itemMap = new Map<string, any>();
      for (const g of items || []) {
        itemMap.set(g.id, { ...g, image_url: urlMap[g.thumbnail_url || g.image_url] || g.image_url });
      }
      return outfits.map((o: any) => ({
        ...o,
        garments: (o.garment_ids || []).map((id: string) => itemMap.get(id)).filter(Boolean),
      }));
    },
  });

  const handlePickSavedLook = useCallback(async (outfit: any) => {
    if (!pickerDate) return;
    const day = days.find((d) => d.dateStr === pickerDate);
    await upsertSync({
      date: pickerDate,
      garmentIds: outfit.garment_ids || [],
      status: "planned",
      source: "saved_look",
      occasion: day?.occasion ?? null,
      tempC: day?.tempC ?? null,
      weatherLabel: day?.weatherLabel ?? null,
    });
    toast.success("Outfit scheduled.");
    setPickerDate(null);
  }, [pickerDate, days, upsertSync]);

  // Past-only handlers
  const handleSuggestForPast = useCallback(async (dateStr: string) => {
    const day = days.find((d) => d.dateStr === dateStr);
    if (!day || wardrobe.length === 0) return;
    setBusyDate(dateStr);
    try {
      const sug = suggestOutfitForDate({
        date: day.date, wardrobe, tempC: day.tempC, occasion: day.occasion,
        events: day.events, history: pastHistory,
      });
      if (!sug.ok) {
        toast.info("No outfit could be generated for this day.");
        return;
      }
      // Persist as suggested + manual so a future auto-fill won't overwrite it.
      await upsertSync({
        date: dateStr,
        garmentIds: sug.items.map((i) => i.id),
        status: "suggested",
        source: "manual",
        occasion: day.occasion,
        tempC: day.tempC,
        weatherLabel: day.weatherLabel,
        eventIds: day.events.map((e) => e.id),
      });
    } finally {
      setBusyDate(null);
    }
  }, [days, wardrobe, pastHistory, upsertSync]);

  const handleMarkWorn = useCallback(async (dateStr: string, status: "worn" | "skipped") => {
    const day = days.find((d) => d.dateStr === dateStr);
    if (!day || day.items.length === 0) return;
    setBusyDate(dateStr);
    try {
      await upsertSync({
        date: dateStr,
        garmentIds: day.items.map((i) => i.id),
        status: (day.row?.status as any) || "planned",
        source: (day.row?.source as any) || "manual",
        occasion: day.occasion,
        tempC: day.tempC,
        weatherLabel: day.weatherLabel,
        wornAt: new Date().toISOString(),
        wornStatus: status,
      });
    } finally {
      setBusyDate(null);
    }
  }, [days, upsertSync]);

  // Visible-week stats
  const futureDays = days.filter((d) => d.dateKind !== "past");
  const emptyCount = futureDays.filter((d) => !d.row || d.row.status === "suggested").length;
  const allPast = futureDays.length === 0;

  const weekLabel = `${format(viewStart, "MMM d")} – ${format(viewEnd, "MMM d")}`;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[90vh] overflow-y-auto pb-10"
          onInteractOutside={ignoreToastInteractOutside}
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 font-outfit">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Outfit Calendar
            </SheetTitle>
          </SheetHeader>

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg h-8 px-2 text-xs"
              onClick={() => setViewStart((d) => addDays(d, -WEEK_DAYS))}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev
            </Button>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground font-outfit">{weekLabel}</p>
              {!isCurrentWeek && (
                <button
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                  onClick={() => setViewStart(startOfWeek(today, { weekStartsOn: 1 }))}
                >
                  This week
                </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg h-8 px-2 text-xs"
              onClick={() => setViewStart((d) => addDays(d, WEEK_DAYS))}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>

          {/* Week grid */}
          {rowsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-3">
                {days.map((day) => (
                  <CalendarDateCell
                    key={day.dateStr}
                    date={day.date}
                    dateKind={day.dateKind}
                    items={day.items}
                    status={day.row?.status || (day.items.length > 0 ? "suggested" : "")}
                    wornStatus={(day.row as any)?.worn_status ?? null}
                    tempC={day.tempC}
                    hasEvents={day.events.length > 0}
                    selected={day.dateStr === selectedDateStr}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                  />
                ))}
              </div>

              {/* Compact auto-fill row */}
              {!allPast && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="rounded-lg text-[12px] h-8 px-3"
                    onClick={() => handleAutoFill(false)}
                    disabled={autoFilling || wardrobe.length === 0}
                  >
                    {autoFilling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                    Auto-fill week
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-lg text-[12px] h-8 px-2"
                    onClick={() => handleAutoFill(true)}
                    disabled={autoFilling || wardrobe.length === 0}
                  >
                    Replace
                  </Button>
                  {emptyCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {emptyCount} pending
                    </span>
                  )}
                </div>
              )}

              {/* Selected date detail */}
              {(() => {
                const day = days.find((d) => d.dateStr === selectedDateStr);
                if (!day) return null;
                return (
                  <DatePlannerCard
                    key={day.dateStr}
                    date={day.date}
                    dateKind={day.dateKind}
                    items={day.items}
                    status={day.row?.status || "suggested"}
                    source={day.row?.source}
                    occasion={day.occasion}
                    tempC={day.tempC}
                    weatherLabel={day.weatherLabel}
                    emptyReason={day.emptyReason}
                    events={day.events}
                    wornStatus={(day.row as any)?.worn_status ?? null}
                    isBusy={busyDate === day.dateStr}
                    onSwap={day.dateKind === "past" ? undefined : () => handleSwap(day.dateStr)}
                    onSave={day.dateKind === "past" ? undefined : () => handleSave(day.dateStr)}
                    onToggleLock={day.dateKind === "future" ? () => handleToggleLock(day.dateStr) : undefined}
                    onOpenEdit={() => setPickerDate(day.dateStr)}
                    onSuggestForPast={day.dateKind === "past" && day.items.length === 0 ? () => handleSuggestForPast(day.dateStr) : undefined}
                    onMarkWorn={day.dateKind === "past" && day.items.length > 0 ? () => handleMarkWorn(day.dateStr, "worn") : undefined}
                    onMarkSkipped={day.dateKind === "past" && day.items.length > 0 ? () => handleMarkWorn(day.dateStr, "skipped") : undefined}
                  />
                );
              })()}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Saved Looks picker drawer */}
      <Drawer open={!!pickerDate} onOpenChange={(o) => !o && setPickerDate(null)}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader>
            <DrawerTitle className="font-outfit">
              Pick a saved look for {pickerDate && format(new Date(pickerDate + "T00:00"), "MMM d")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-3 overflow-y-auto">
            {pickerDate && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-lg text-xs"
                onClick={async () => {
                  await del.mutateAsync(pickerDate);
                  toast.success("Cleared.");
                  setPickerDate(null);
                }}
              >
                Clear this day
              </Button>
            )}
            {isLoadingLookbook ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : lookbook.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Your Lookbook is empty. Create outfits in your Wardrobe first!
              </p>
            ) : (
              lookbook.map((outfit: any) => {
                const garments: any[] = outfit.garments || [];
                const isGenericName = !outfit.name || /^(my outfit|vora stylist look|outfit)$/i.test(String(outfit.name).trim());
                const subtitle = garments.length > 0
                  ? garments.slice(0, 2).map((g) => g.name || g.category || "Item").join(" + ")
                  : `${outfit.garment_ids?.length ?? 0} items`;
                const thumbs = garments.slice(0, 4);
                return (
                  <GlassCard
                    key={outfit.id}
                    className="p-3 !rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => handlePickSavedLook(outfit)}
                  >
                    <div className="flex gap-3">
                      <div className="grid grid-cols-2 gap-1 w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted">
                        {thumbs.length > 0 ? (
                          <>
                            {thumbs.map((g, i) => (
                              <div key={g.id || i} className="bg-muted overflow-hidden">
                                <SafeImage src={g.image_url} alt={g.name || "Garment"} fit="contain" />
                              </div>
                            ))}
                            {thumbs.length < 4 && Array.from({ length: 4 - thumbs.length }).map((_, i) => (
                              <div key={`empty-${i}`} className="bg-muted/50" />
                            ))}
                          </>
                        ) : (
                          <div className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground">
                            <Shirt className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {outfit.name || "Outfit"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {isGenericName ? subtitle : `${garments.length || outfit.garment_ids?.length || 0} items · ${subtitle}`}
                          </p>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button size="sm" variant="secondary" className="rounded-lg text-xs h-7 px-3">
                            Select
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
