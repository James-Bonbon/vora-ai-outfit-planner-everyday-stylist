/**
 * DatePlannerCard — visual outfit card for one day in the planner.
 *
 * Shows a mini outfit collage, weather/occasion, status pill, and Swap/Lock/Save actions.
 * Never blank: falls back to "Not enough wardrobe items" or stacked thumbs.
 */

import { format } from "date-fns";
import { RefreshCw, Lock, Unlock, Check, ShirtIcon, Sun, Cloud, CloudRain, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";
import SafeImage from "@/components/ui/SafeImage";
import type { StylingItem } from "@/utils/stylingEngine";

interface Props {
  date: Date;
  items: StylingItem[];
  status: "suggested" | "planned" | "locked" | string;
  source?: string | null;
  occasion?: string | null;
  tempC?: number | null;
  weatherLabel?: string | null;
  emptyReason?: "wardrobe_too_small" | "no_match" | null;
  onSwap?: () => void;
  onSave?: () => void;
  onToggleLock?: () => void;
  onOpenEdit?: () => void;
  isBusy?: boolean;
}

const WEATHER_ICON: Record<string, typeof Sun> = {
  warm: Sun, cool: Snowflake, neutral: Cloud, rainy: CloudRain,
};

function StatusPill({ status }: { status: string }) {
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

export default function DatePlannerCard({
  date, items, status, occasion, tempC, weatherLabel,
  emptyReason, onSwap, onSave, onToggleLock, onOpenEdit, isBusy,
}: Props) {
  const Icon = WEATHER_ICON[weatherLabel || "neutral"] || Cloud;
  const isLocked = status === "locked";
  const hasItems = items.length > 0;

  return (
    <GlassCard className="p-3 !rounded-2xl">
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
          <StatusPill status={status} />
        </div>
      </div>

      {/* Visual */}
      <button
        type="button"
        onClick={onOpenEdit}
        className="block w-full text-left"
        disabled={isLocked}
      >
        {hasItems ? (
          <div className="rounded-xl overflow-hidden">
            <OutfitCollage garments={items as any} />
          </div>
        ) : emptyReason === "wardrobe_too_small" ? (
          <div className="aspect-[3/4] rounded-xl bg-muted flex flex-col items-center justify-center text-center px-4">
            <ShirtIcon className="w-6 h-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Not enough wardrobe items — add items to your closet.
            </p>
          </div>
        ) : (
          // Fallback: stacked thumbs (also covers collage failure scenarios)
          <div className="aspect-[3/4] rounded-xl bg-muted flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">No outfit yet</p>
          </div>
        )}
      </button>

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
        {onToggleLock && hasItems && (
          <Button size="sm" variant="outline" className="rounded-lg text-[11px] h-7 px-2.5" onClick={onToggleLock} disabled={isBusy}>
            {isLocked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
            {isLocked ? "Unlock" : "Lock"}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
