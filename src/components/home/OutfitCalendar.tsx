import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, format, isToday, getDay } from "date-fns";
import { Snowflake, Sun, Cloud, CloudRain, RefreshCw, Pencil, Lock, ShirtIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { OutfitFlatLay } from "@/components/OutfitFlatLay";
import { useNavigate } from "react-router-dom";
import {
  generateSmartOutfit,
  generateSwappedOutfit,
  countPools,
  MIN_TOPS,
  MIN_BOTTOMS,
  type StylingItem,
} from "@/utils/stylingEngine";

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
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [garments, setGarments] = useState<Record<string, GarmentSnapshot>>({});
  const [garmentPool, setGarmentPool] = useState<GarmentSnapshot[]>([]);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<"top" | "bottom">("top");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch profile tier + closet items + dream items ---- */
  const fetchBootstrap = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, closetRes, dreamRes] = await Promise.all([
      supabase.from("profiles").select("subscription_tier").eq("user_id", user.id).maybeSingle(),
      supabase.from("closet_items").select("id, name, image_url, category, created_at, is_in_laundry").eq("user_id", user.id),
      supabase.from("dream_items").select("id, name, image_url, created_at").eq("user_id", user.id),
    ]);

    if (profileRes.data) {
      setSubscriptionTier(profileRes.data.subscription_tier || "free");
    }

    const pool: GarmentSnapshot[] = [];

    // Sign closet item URLs
    if (closetRes.data && closetRes.data.length > 0) {
      const withUrls = await Promise.all(
        closetRes.data.map(async (item) => {
          const { data } = await supabase.storage.from("garments").createSignedUrl(item.image_url, 3600);
          return {
            id: item.id,
            name: item.name,
            image_url: data?.signedUrl || item.image_url,
            category: item.category,
            created_at: item.created_at,
            is_in_laundry: item.is_in_laundry,
            source: "closet" as const,
          };
        }),
      );
      pool.push(...withUrls);
    }

    // Sign dream item URLs (dream items use direct URLs, no signing needed unless stored in bucket)
    if (dreamRes.data && dreamRes.data.length > 0) {
      const withUrls = await Promise.all(
        dreamRes.data.map(async (item) => {
          // Dream items may use external URLs or garments bucket
          const isPath = !item.image_url.startsWith("http");
          let url = item.image_url;
          if (isPath) {
            const { data } = await supabase.storage.from("garments").createSignedUrl(item.image_url, 3600);
            url = data?.signedUrl || item.image_url;
          }
          return { id: item.id, name: item.name, image_url: url, category: null, created_at: item.created_at, source: "dream" as const };
        }),
      );
      pool.push(...withUrls);
    }

    setGarmentPool(pool);
    setLoading(false);
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

  /* ---- Resolve garment images (with signed URLs) ---- */
  useEffect(() => {
    const allIds = entries.flatMap((e) => e.garment_ids || []);
    const unique = [...new Set(allIds)].filter((id) => !garments[id]);
    if (unique.length === 0) return;

    (async () => {
      const { data } = await supabase.from("closet_items").select("id, name, image_url, category").in("id", unique);
      if (data) {
        const withUrls = await Promise.all(
          data.map(async (g) => {
            const { data: urlData } = await supabase.storage.from("garments").createSignedUrl(g.image_url, 3600);
            return { ...g, image_url: urlData?.signedUrl || g.image_url, source: "closet" as const } as GarmentSnapshot;
          }),
        );
        const map: Record<string, GarmentSnapshot> = { ...garments };
        withUrls.forEach((g) => (map[g.id] = g));
        setGarments(map);
      }
    })();
  }, [entries]);

  useEffect(() => {
    fetchBootstrap();
    fetchCalendar();
  }, [fetchBootstrap, fetchCalendar]);

  /* ---- Pool counts & threshold (via styling engine) ---- */
  const { topsCount, bottomsCount, meetsThreshold } = useMemo(
    () => countPools(garmentPool),
    [garmentPool],
  );

  /* ---- Swap counters per date (deterministic rotation) ---- */
  const [swapCounts, setSwapCounts] = useState<Record<string, number>>({});

  /* ---- Get contextual items for a date ---- */
  const getItemsForDate = useCallback(
    (date: Date, entry?: CalendarEntry): GarmentSnapshot[] => {
      if (entry && entry.garment_ids && entry.garment_ids.length > 0) {
        return entry.garment_ids.map((id) => garments[id]).filter(Boolean);
      }
      if (!meetsThreshold) return [];

      const dateStr = format(date, "yyyy-MM-dd");
      const swapOffset = swapCounts[dateStr] || 0;

      if (swapOffset > 0) {
        return generateSwappedOutfit(garmentPool, date, swapOffset) as GarmentSnapshot[];
      }

      return generateSmartOutfit(garmentPool, date) as GarmentSnapshot[];
    },
    [garments, garmentPool, meetsThreshold, swapCounts],
  );

  /* ---- Swap handler (deterministic rotation, no Math.random) ---- */
  const handleSwap = useCallback(
    (dateStr: string) => {
      if (!meetsThreshold) return;
      const newCount = (swapCounts[dateStr] || 0) + 1;
      setSwapCounts((prev) => ({ ...prev, [dateStr]: newCount }));

      // Generate the swapped outfit to update garments map & entries
      const date = new Date(dateStr + "T00:00");
      const swapped = generateSwappedOutfit(garmentPool, date, newCount);
      if (swapped.length === 0) return;

      const map = { ...garments };
      swapped.forEach((g) => (map[g.id] = g as GarmentSnapshot));
      setGarments(map);

      setEntries((prev) => {
        const existing = prev.find((e) => e.date === dateStr);
        if (existing) {
          return prev.map((e) => (e.date === dateStr ? { ...e, garment_ids: swapped.map((g) => g.id) } : e));
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            date: dateStr,
            garment_ids: swapped.map((g) => g.id),
            weather_temp: null,
            weather_label: null,
            occasion: null,
            status: "suggested",
          },
        ];
      });
    },
    [garments, garmentPool, meetsThreshold, swapCounts],
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
    [editingDate, editingSlot, garments],
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

  /* ---- LOCKED STATE: Not enough items ---- */
  if (!loading && !meetsThreshold) {
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
            Add at least 7 Tops and 3 Bottoms to your Wardrobe or Dream List to activate the Outfit Calendar.
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

  if (loading) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
      </GlassCard>
    );
  }

  const todaySlot = days[0];
  const visibleUpcoming = days.slice(1, maxDays);
  const showLockedCard = subscriptionTier !== "pro";

  const todayGarments = getItemsForDate(todaySlot.date, todaySlot.entry);
  const WeatherIconComp = WEATHER_ICON[todaySlot.entry?.weather_label || "neutral"] || Cloud;
  const tempDisplay = todaySlot.entry?.weather_temp ? `${Math.round(todaySlot.entry.weather_temp)}°F` : "";
  const todayOccasion = todaySlot.entry?.occasion || (isWeekend(todaySlot.date) ? "Casual" : "Smart Casual");

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="rounded-2xl glass-card p-4">
        {/* ===== TODAY'S OUTFIT CARD ===== */}
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
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

          {/* Flat-Lay Display */}
          {todayGarments.length > 0 ? (
            <OutfitFlatLay
              garments={todayGarments}
              onTryOnMake={() => {
                // Navigate to AI Stylist with garments pre-selected
                navigate("/mirror", {
                  state: {
                    preSelectedIds: todayGarments.map((g) => g.id),
                    vibe: todayOccasion,
                  },
                });
              }}
            />
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
                  setEditingSlot("top");
                }}
              >
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            </DrawerTrigger>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-center">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {todaySlot.entry ? "Planned Outfit" : "Suggested Outfit"}
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
                        <p className="text-sm font-bold text-foreground font-outfit">{format(slot.date, "EEE d")}</p>
                        <span className="text-[9px] text-muted-foreground capitalize">{occasion}</span>
                      </div>

                      <div className="flex gap-1.5 mt-2">
                        {slotGarments.length > 0 ? (
                          slotGarments.slice(0, 2).map((g) => (
                            <div
                              key={g.id}
                              className="w-[52px] h-[64px] rounded-lg overflow-hidden bg-product-bg p-1 flex items-center justify-center mix-blend-multiply"
                            >
                              <SafeImage
                                src={g.image_url}
                                alt={g.name || "Garment"}
                                aspectRatio=""
                                fit="contain"
                                className="drop-shadow-sm"
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

            <div className="flex justify-center gap-1.5 mt-3">
              {visibleUpcoming.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} />
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
