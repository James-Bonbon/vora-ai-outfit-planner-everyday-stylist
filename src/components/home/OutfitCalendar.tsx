import { useState, useEffect, useCallback } from "react";
import { addDays, format, isToday } from "date-fns";
import { CalendarDays, Snowflake, Sun, Cloud, CloudRain, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

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

const WEATHER_ICON: Record<string, typeof Sun> = {
  warm: Sun,
  cool: Snowflake,
  neutral: Cloud,
  rainy: CloudRain,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const OutfitCalendar = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [garments, setGarments] = useState<Record<string, GarmentSnapshot>>({});

  // Fetch outfit calendar entries for the next 7 days
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

  // Fetch garment details for all referenced garment_ids
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
    fetchCalendar();
  }, [fetchCalendar]);

  /* Build day slots for next 7 days */
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entries.find((e) => e.date === dateStr);
    return { date, dateStr, entry, isToday: isToday(date) };
  });

  const todaySlot = days[0];
  const upcomingSlots = days.slice(1);

  const todayGarments = (todaySlot.entry?.garment_ids || [])
    .map((id) => garments[id])
    .filter(Boolean);

  const WeatherIconComp = WEATHER_ICON[todaySlot.entry?.weather_label || "neutral"] || Cloud;
  const tempDisplay = todaySlot.entry?.weather_temp
    ? `${Math.round(todaySlot.entry.weather_temp)}°F`
    : "";

  return (
    <div className="rounded-3xl bg-calendar p-4 shadow-lg border border-calendar-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-calendar-text font-outfit tracking-tight">
          Outfit Calendar
        </h3>
        <CalendarDays className="w-5 h-5 text-calendar-text-muted" />
      </div>

      {/* ===== TODAY'S OUTFIT CARD ===== */}
      <div className="rounded-2xl bg-calendar-card border border-calendar-border p-4 mb-4">
        {/* Top badges row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-calendar-accent text-calendar-accent-foreground text-[11px] font-semibold">
            Today
          </span>
          {tempDisplay && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-calendar-border text-calendar-text text-[11px] font-medium">
              <WeatherIconComp className="w-3.5 h-3.5" />
              {tempDisplay}
            </span>
          )}
        </div>

        <div className="flex gap-4">
          {/* Left: date + details */}
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-calendar-text font-outfit leading-none">
              {format(new Date(), "EEE d")}
            </p>
            {todaySlot.entry?.weather_label && (
              <p className="text-xs text-calendar-text-muted mt-1 capitalize">
                {todaySlot.entry.weather_label}
                {tempDisplay && ` · ${tempDisplay}`}
              </p>
            )}

            {/* Garment names */}
            <div className="mt-3 space-y-1">
              {todayGarments.length > 0 ? (
                todayGarments.slice(0, 3).map((g) => (
                  <p key={g.id} className="text-sm text-calendar-text font-medium truncate">
                    {g.name || g.category || "Garment"}
                  </p>
                ))
              ) : (
                <p className="text-sm text-calendar-text-muted italic">No outfit planned yet</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                className="rounded-xl bg-calendar-accent text-calendar-accent-foreground hover:bg-calendar-accent/90 text-xs h-8 px-4"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Swap
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-calendar-accent text-calendar-accent hover:bg-calendar-accent/10 text-xs h-8 px-4"
              >
                <Pencil className="w-3 h-3 mr-1" /> Edit
              </Button>
            </div>
          </div>

          {/* Right: garment images */}
          <div className="flex gap-2 shrink-0">
            {todayGarments.length > 0 ? (
              todayGarments.slice(0, 2).map((g) => (
                <div
                  key={g.id}
                  className="w-[72px] h-[96px] rounded-xl overflow-hidden bg-calendar-border"
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
                <div className="w-[72px] h-[96px] rounded-xl bg-calendar-border flex items-center justify-center">
                  <span className="text-[10px] text-calendar-text-muted">Top</span>
                </div>
                <div className="w-[72px] h-[96px] rounded-xl bg-calendar-border flex items-center justify-center">
                  <span className="text-[10px] text-calendar-text-muted">Bottom</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer label */}
        <div className="mt-4 pt-3 border-t border-calendar-border text-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-calendar-text-muted">
            {todaySlot.entry ? "Planned Outfit" : "No Outfit Planned"}
          </span>
        </div>
      </div>

      {/* ===== UPCOMING DAYS CAROUSEL ===== */}
      {upcomingSlots.length > 0 && (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-2">
            {upcomingSlots.map((slot) => {
              const slotGarments = (slot.entry?.garment_ids || [])
                .map((id) => garments[id])
                .filter(Boolean);

              return (
                <CarouselItem key={slot.dateStr} className="pl-2 basis-[55%] sm:basis-[42%]">
                  <div className="rounded-2xl bg-calendar-card border border-calendar-border p-3">
                    <p className="text-sm font-bold text-calendar-text font-outfit">
                      {format(slot.date, "EEE d")}
                    </p>

                    {/* Small garment images */}
                    <div className="flex gap-1.5 mt-2">
                      {slotGarments.length > 0 ? (
                        slotGarments.slice(0, 2).map((g) => (
                          <div
                            key={g.id}
                            className="w-[52px] h-[64px] rounded-lg overflow-hidden bg-calendar-border"
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
                          <div className="w-[52px] h-[64px] rounded-lg bg-calendar-border" />
                          <div className="w-[52px] h-[64px] rounded-lg bg-calendar-border" />
                        </>
                      )}
                    </div>

                    {/* Item names */}
                    <div className="mt-2 space-y-0.5">
                      {slotGarments.length > 0 ? (
                        slotGarments.slice(0, 2).map((g) => (
                          <p key={g.id} className="text-[11px] text-calendar-text truncate">
                            {g.name || g.category || "Garment"}
                          </p>
                        ))
                      ) : (
                        <p className="text-[11px] text-calendar-text-muted italic">Empty</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-2 pt-2 border-t border-calendar-border text-center">
                      <span className="text-[9px] font-medium uppercase tracking-widest text-calendar-text-muted">
                        {slot.entry ? (slot.entry.status === "planned" ? "Planned Outfit" : "Suggested Outfit") : "No Outfit"}
                      </span>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {/* Dots indicator */}
          <div className="flex justify-center gap-1.5 mt-3">
            {upcomingSlots.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-calendar-accent" : "bg-calendar-border"}`}
              />
            ))}
          </div>
        </Carousel>
      )}
    </div>
  );
};

export default OutfitCalendar;
