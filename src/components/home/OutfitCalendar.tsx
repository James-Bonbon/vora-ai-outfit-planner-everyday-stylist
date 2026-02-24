import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, format, isToday, getDay } from "date-fns";
import { CalendarDays, Snowflake, Sun, Cloud, CloudRain, RefreshCw, Pencil, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CalendarEntry {
  id: string;
  date: string;
  garment_ids: string[];
  weather_temp: number | null;
  weather_label: string | null;
  occasion: string | null;
  status: string;
}

interface GarmentSnapshot {
  id: string;
  name: string | null;
  image_url: string;
  category: string | null;
}

interface TrendingItem {
  id: string;
  title: string;
  image_url: string | null;
  category: string | null;
}

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
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [garments, setGarments] = useState<Record<string, GarmentSnapshot>>({});
  const [closetItems, setClosetItems] = useState<GarmentSnapshot[]>([]);
  const [trendingFallback, setTrendingFallback] = useState<GarmentSnapshot[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<"top" | "bottom">("top");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const useFallback = closetItems.length < 2;

  /* ---- Fetch profile tier + closet items + trending fallback ---- */
  const fetchBootstrap = useCallback(async () => {
    if (!user) return;

    const [profileRes, closetRes, trendingRes] = await Promise.all([
      supabase.from("profiles").select("subscription_tier, sex").eq("user_id", user.id).maybeSingle(),
      supabase.from("closet_items").select("id, name, image_url, category").eq("user_id", user.id),
      supabase.from("trending_clothes").select("id, title, image_url, category").limit(40),
    ]);

    if (profileRes.data) {
      setSubscriptionTier(profileRes.data.subscription_tier || "free");
    }

    if (closetRes.data) {
      setClosetItems(closetRes.data as GarmentSnapshot[]);
    }

    // Build fallback from trending, mapping title→name
    if (trendingRes.data) {
      const sex = profileRes.data?.sex || "female";
      const mapped: GarmentSnapshot[] = (trendingRes.data as TrendingItem[])
        .filter((t) => t.image_url)
        .map((t) => ({
          id: t.id,
          name: t.title,
          image_url: t.image_url!,
          category: t.category,
        }));
      setTrendingFallback(mapped);
    }
  }, [user]);

  /* ---- Fetch calendar entries ---- */
  const fetchCalendar = useCallback(async () => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), 6), "yyyy-MM-dd");

    const { data } = await supabase
      .from("outfit_calendar")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", today)
      .lte("date", end)
      .order("date");

    if (data) setEntries(data as CalendarEntry[]);
  }, [user]);

  /* ---- Resolve garment images ---- */
  useEffect(() => {
    const allIds = entries.flatMap((e) => e.garment_ids || []);
    const unique = [...new Set(allIds)].filter((id) => !garments[id]);
    if (unique.length === 0) return;

    (async () => {
      const { data } = await supabase
        .from("closet_items")
        .select("id, name, image_url, category")
        .in("id", unique);
      if (data) {
        const map: Record<string, GarmentSnapshot> = { ...garments };
        data.forEach((g) => (map[g.id] = g));
        setGarments(map);
      }
    })();
  }, [entries]);

  useEffect(() => {
    fetchBootstrap();
    fetchCalendar();
  }, [fetchBootstrap, fetchCalendar]);

  /* ---- Pool of items to pick from ---- */
  const pool = useFallback ? trendingFallback : closetItems;

  /* ---- Get contextual items for a date ---- */
  const getItemsForDate = useCallback(
    (date: Date, entry?: CalendarEntry): GarmentSnapshot[] => {
      // If we have saved garment_ids, resolve them
      if (entry && entry.garment_ids && entry.garment_ids.length > 0) {
        return entry.garment_ids.map((id) => garments[id]).filter(Boolean);
      }

      if (pool.length === 0) return [];

      // Deterministic pick based on date
      const seed = date.getTime();
      const pick = (offset: number) => {
        const idx = Math.abs((seed + offset * 2654435761) | 0) % pool.length;
        return pool[idx];
      };

      return [pick(0), pick(1)].filter(Boolean);
    },
    [garments, pool]
  );

  /* ---- Swap handler ---- */
  const handleSwap = useCallback(
    (dateStr: string) => {
      if (pool.length < 2) return;
      const randomTwo: GarmentSnapshot[] = [];
      const indices = new Set<number>();
      while (randomTwo.length < 2 && indices.size < pool.length) {
        const idx = Math.floor(Math.random() * pool.length);
        if (!indices.has(idx)) {
          indices.add(idx);
          randomTwo.push(pool[idx]);
        }
      }
      // Update local garments map and entry
      const map = { ...garments };
      randomTwo.forEach((g) => (map[g.id] = g));
      setGarments(map);

      setEntries((prev) => {
        const existing = prev.find((e) => e.date === dateStr);
        if (existing) {
          return prev.map((e) =>
            e.date === dateStr ? { ...e, garment_ids: randomTwo.map((g) => g.id) } : e
          );
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            date: dateStr,
            garment_ids: randomTwo.map((g) => g.id),
            weather_temp: null,
            weather_label: null,
            occasion: null,
            status: "suggested",
          },
        ];
      });
    },
    [pool, garments]
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
        let newIds: string[];
        if (editingSlot === "top") {
          newIds = [item.id, ...(currentIds.length > 1 ? [currentIds[1]] : [])];
        } else {
          newIds = [...(currentIds.length > 0 ? [currentIds[0]] : []), item.id];
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
    [editingDate, editingSlot, garments]
  );

  /* ---- Build day slots ---- */
  const maxDays = subscriptionTier === "pro" ? 7 : 3;

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const entry = entries.find((e) => e.date === dateStr);
      return { date, dateStr, entry, isToday: isToday(date) };
    });
  }, [entries]);

  const todaySlot = days[0];
  const visibleUpcoming = days.slice(1, maxDays);
  const showLockedCard = subscriptionTier !== "pro";

  const todayGarments = getItemsForDate(todaySlot.date, todaySlot.entry);
  const WeatherIconComp = WEATHER_ICON[todaySlot.entry?.weather_label || "neutral"] || Cloud;
  const tempDisplay = todaySlot.entry?.weather_temp
    ? `${Math.round(todaySlot.entry.weather_temp)}°F`
    : "";
  const todayOccasion = todaySlot.entry?.occasion || (isWeekend(todaySlot.date) ? "Casual" : "Smart Casual");

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="rounded-2xl glass-card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground font-outfit tracking-tight">
            Outfit Calendar
          </h3>
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* ===== TODAY'S OUTFIT CARD ===== */}
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          {/* Top badges row */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
              Today
            </span>
            {tempDisplay && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground text-[11px] font-medium">
                <WeatherIconComp className="w-3.5 h-3.5" />
                {tempDisplay}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
              {todayOccasion}
            </span>
          </div>

          <div className="flex gap-4">
            {/* Left: date + details */}
            <div className="flex-1 min-w-0 flex flex-col">
              <p className="text-2xl font-bold text-foreground font-outfit leading-none">
                {format(new Date(), "EEE d")}
              </p>
              {todaySlot.entry?.weather_label && (
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {todaySlot.entry.weather_label}
                  {tempDisplay && ` · ${tempDisplay}`}
                </p>
              )}

              {/* Garment names */}
              <div className="mt-3 space-y-1">
                {todayGarments.length > 0 ? (
                  todayGarments.slice(0, 3).map((g) => (
                    <p key={g.id} className="text-sm text-foreground font-medium truncate">
                      {g.name || g.category || "Garment"}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">No outfit planned yet</p>
                )}
              </div>

              {/* Action buttons – pinned at bottom */}
              <div className="flex gap-2 mt-auto pt-4">
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
                      setEditingSlot("top");
                    }}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </DrawerTrigger>
              </div>
            </div>

            {/* Right: garment images – fixed size */}
            <div className="flex gap-2 shrink-0">
              {todayGarments.length > 0 ? (
                todayGarments.slice(0, 2).map((g) => (
                  <div
                    key={g.id}
                    className="w-20 h-24 rounded-xl overflow-hidden bg-muted"
                  >
                    <SafeImage
                      src={g.image_url}
                      alt={g.name || "Garment"}
                      aspectRatio=""
                      wrapperClassName="w-full h-full"
                    />
                  </div>
                ))
              ) : (
                <>
                  <div className="w-20 h-24 rounded-xl bg-muted flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Top</span>
                  </div>
                  <div className="w-20 h-24 rounded-xl bg-muted flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Bottom</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer label */}
          <div className="mt-4 pt-3 border-t border-border text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {todaySlot.entry ? "Planned Outfit" : useFallback ? "Suggested from Trending" : "No Outfit Planned"}
            </span>
          </div>
        </div>

        {/* ===== UPCOMING DAYS CAROUSEL ===== */}
        {visibleUpcoming.length > 0 && (
          <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
            <CarouselContent className="-ml-2">
              {visibleUpcoming.map((slot) => {
                const slotGarments = getItemsForDate(slot.date, slot.entry);
                const occasion = slot.entry?.occasion || (isWeekend(slot.date) ? "Casual" : "Office");

                return (
                  <CarouselItem key={slot.dateStr} className="pl-2 basis-[55%] sm:basis-[42%]">
                    <div className="rounded-2xl bg-card border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-foreground font-outfit">
                          {format(slot.date, "EEE d")}
                        </p>
                        <span className="text-[9px] text-muted-foreground capitalize">{occasion}</span>
                      </div>

                      {/* Small garment images */}
                      <div className="flex gap-1.5 mt-2">
                        {slotGarments.length > 0 ? (
                          slotGarments.slice(0, 2).map((g) => (
                            <div
                              key={g.id}
                              className="w-[52px] h-[64px] rounded-lg overflow-hidden bg-muted"
                            >
                              <SafeImage
                                src={g.image_url}
                                alt={g.name || "Garment"}
                                aspectRatio=""
                                wrapperClassName="w-full h-full"
                              />
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="w-[52px] h-[64px] rounded-lg bg-muted" />
                            <div className="w-[52px] h-[64px] rounded-lg bg-muted" />
                          </>
                        )}
                      </div>

                      {/* Item names */}
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

                      {/* Footer */}
                      <div className="mt-2 pt-2 border-t border-border text-center">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                          {slot.entry ? "Planned" : "Suggested"}
                        </span>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}

              {/* Locked upgrade card */}
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

            {/* Dots indicator */}
            <div className="flex justify-center gap-1.5 mt-3">
              {visibleUpcoming.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`}
                />
              ))}
              {showLockedCard && <div className="w-1.5 h-1.5 rounded-full bg-border" />}
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
        <div className="px-4 pb-6 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {(useFallback ? trendingFallback : closetItems).map((item) => (
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
              <p className="text-[10px] text-foreground p-1.5 truncate">
                {item.name || item.category || "Item"}
              </p>
            </button>
          ))}
          {pool.length === 0 && (
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
