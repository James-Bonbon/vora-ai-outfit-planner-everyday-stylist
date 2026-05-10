/**
 * DatePlannerCard — visual outfit card for one day in the planner.
 *
 * Variants by dateKind:
 *   - past:   read-only collage; "Mark worn / skipped"; if empty → explicit
 *             "Add outfit" / "Suggest outfit" (no auto-generation).
 *   - today:  Swap / Edit / Save; "Worn" pill once marked.
 *   - future: Swap / Edit / Save / Lock.
 *
 * Optional event chips row appears under the header.
 */

import { format } from "date-fns";
import {
  RefreshCw, Lock, Unlock, Check, ShirtIcon, Sun, Cloud, CloudRain, Snowflake,
  Sparkles, Plus, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { StylingItem } from "@/utils/stylingEngine";
import type { EventWithOccasion } from "@/hooks/useCalendarEvents";

export type DateKind = "past" | "today" | "future";

interface Props {
  date: Date;
  dateKind: DateKind;
  items: StylingItem[];
  status: "suggested" | "planned" | "locked" | string;
  source?: string | null;
  occasion?: string | null;
  tempC?: number | null;
  weatherLabel?: string | null;
  emptyReason?: "wardrobe_too_small" | "no_match" | null;
  events?: EventWithOccasion[];
  wornStatus?: "worn" | "skipped" | null;
  onSwap?: () => void;
  onSave?: () => void;
  onToggleLock?: () => void;
  onOpenEdit?: () => void;
  /** Past-only: explicit suggestion request (no auto-generation). */
  onSuggestForPast?: () => void;
  /** Past-only: mark worn / skipped. */
  onMarkWorn?: () => void;
  onMarkSkipped?: () => void;
  isBusy?: boolean;
}

const WEATHER_ICON: Record<string, typeof Sun> = {
  warm: Sun, cool: Snowflake, neutral: Cloud, rainy: CloudRain,
};

function StatusPill({ status, wornStatus }: { status: string; wornStatus?: "worn" | "skipped" | null }) {
  if (wornStatus === "worn") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-medium">
        <CheckCircle2 className="w-2.5 h-2.5" /> Worn
      </span>
    );
  }
  if (wornStatus === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
        <XCircle className="w-2.5 h-2.5" /> Skipped
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-[10px] font-medium text-foreground">
        <Lock className="w-2.5 h-2.5" /> Locked
      </span>
    );
  }
  if (status === "planned") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
        Planned
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
      Suggested
    </span>
  );
}

function EventChips({ events }: { events: EventWithOccasion[] }) {
  if (!events || events.length === 0) return null;
  const visible = events.slice(0, 2);
  const overflow = events.length - visible.length;
  const fmt = (ev: EventWithOccasion) =>
    ev.is_all_day ? ev.title : `${format(new Date(ev.start_time), "HH:mm")} ${ev.title}`;
  return (
    <div className="flex items-center gap-1 flex-wrap mb-2">
      {visible.map((ev) => (
        <span
          key={ev.id}
          className="px-2 py-0.5 rounded-full bg-accent/40 text-foreground text-[10px] font-medium max-w-[150px] truncate"
          title={ev.title}
        >
          {fmt(ev)}
        </span>
      ))}
      {overflow > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
              +{overflow} more
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 space-y-1 rounded-xl">
            {events.slice(2).map((ev) => (
              <p key={ev.id} className="text-[11px] text-foreground truncate">
                {fmt(ev)}
              </p>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default function DatePlannerCard({
  date, dateKind, items, status, occasion, tempC, weatherLabel,
  emptyReason, events, wornStatus,
  onSwap, onSave, onToggleLock, onOpenEdit,
  onSuggestForPast, onMarkWorn, onMarkSkipped, isBusy,
}: Props) {
  const Icon = WEATHER_ICON[weatherLabel || "neutral"] || Cloud;
  const isLocked = status === "locked";
  const isPast = dateKind === "past";
  const hasItems = items.length > 0;

  return (
    <GlassCard className={`p-3 !rounded-2xl ${isPast ? "opacity-95" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {format(date, "EEE")}
          </p>
          <p className="text-base font-bold text-foreground font-outfit leading-none">
            {format(date, "d MMM")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {tempC != null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground text-[10px] font-medium">
              <Icon className="w-2.5 h-2.5" />
              {Math.round(tempC)}°
            </span>
          )}
          {occasion && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium capitalize max-w-[110px] truncate">
              {occasion}
            </span>
          )}
          <StatusPill status={status} wornStatus={wornStatus} />
        </div>
      </div>

      <EventChips events={events || []} />

      {/* Visual */}
      {hasItems ? (
        <button
          type="button"
          onClick={isPast || isLocked ? undefined : onOpenEdit}
          className="block w-full text-left"
          disabled={isPast || isLocked}
        >
          <div className="rounded-xl overflow-hidden">
            <OutfitCollage garments={items as any} />
          </div>
        </button>
      ) : isPast ? (
        <div className="aspect-[3/4] rounded-xl bg-muted flex flex-col items-center justify-center text-center px-4 gap-2">
          <ShirtIcon className="w-6 h-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No outfit recorded</p>
          <div className="flex gap-2">
            {onOpenEdit && (
              <Button size="sm" variant="outline" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onOpenEdit} disabled={isBusy}>
                <Plus className="w-3 h-3 mr-1" /> Add outfit
              </Button>
            )}
            {onSuggestForPast && (
              <Button size="sm" variant="ghost" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onSuggestForPast} disabled={isBusy}>
                <Sparkles className="w-3 h-3 mr-1" /> Suggest
              </Button>
            )}
          </div>
        </div>
      ) : emptyReason === "wardrobe_too_small" ? (
        <div className="aspect-[3/4] rounded-xl bg-muted flex flex-col items-center justify-center text-center px-4">
          <ShirtIcon className="w-6 h-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Not enough wardrobe items — add items to your closet.
          </p>
        </div>
      ) : (
        <div className="aspect-[3/4] rounded-xl bg-muted flex items-center justify-center">
          <p className="text-xs text-muted-foreground italic">No outfit yet</p>
        </div>
      )}

      {/* Garment names */}
      {hasItems && (
        <div className="mt-2 space-y-0.5">
          {items.slice(0, 3).map((g) => (
            <p key={g.id} className="text-[11px] text-foreground truncate">
              {g.name || g.category || "Garment"}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {isPast ? (
          hasItems && (
            <>
              {onMarkWorn && (
                <Button
                  size="sm"
                  variant={wornStatus === "worn" ? "default" : "outline"}
                  className="rounded-lg text-[11px] h-7 px-2.5"
                  onClick={onMarkWorn}
                  disabled={isBusy}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {wornStatus === "worn" ? "Worn" : "Mark worn"}
                </Button>
              )}
              {onMarkSkipped && (
                <Button
                  size="sm"
                  variant={wornStatus === "skipped" ? "default" : "outline"}
                  className="rounded-lg text-[11px] h-7 px-2.5"
                  onClick={onMarkSkipped}
                  disabled={isBusy}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  {wornStatus === "skipped" ? "Skipped" : "Skip"}
                </Button>
              )}
            </>
          )
        ) : (
          <>
            {onSwap && !isLocked && hasItems && (
              <Button size="sm" variant="secondary" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onSwap} disabled={isBusy}>
                <RefreshCw className="w-3 h-3 mr-1" /> Swap
              </Button>
            )}
            {onSave && !isLocked && hasItems && status !== "planned" && (
              <Button size="sm" variant="default" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onSave} disabled={isBusy}>
                <Check className="w-3 h-3 mr-1" /> Plan
              </Button>
            )}
            {onToggleLock && hasItems && dateKind === "future" && (
              <Button size="sm" variant="outline" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onToggleLock} disabled={isBusy}>
                {isLocked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                {isLocked ? "Unlock" : "Lock"}
              </Button>
            )}
          </>
        )}
      </div>
    </GlassCard>
  );
}
