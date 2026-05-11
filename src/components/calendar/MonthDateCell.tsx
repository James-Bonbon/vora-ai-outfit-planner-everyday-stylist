/**
 * MonthDateCell — compact date cell for the month grid.
 *
 * Optimized for 7-column mobile grids. Renders a single thumbnail or a tiny
 * 2×2 collage so outfits remain recognizable while keeping the month view fast.
 */

import { Lock, CheckCircle2, XCircle } from "lucide-react";
import type { StylingItem } from "@/utils/stylingEngine";
import { cn } from "@/lib/utils";

interface Props {
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  items: StylingItem[];
  status?: string;
  wornStatus?: "worn" | "skipped" | null;
  tempC?: number | null;
  hasEvents?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function StatusDot({ status, wornStatus }: { status?: string; wornStatus?: "worn" | "skipped" | null }) {
  if (wornStatus === "worn") return <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />;
  if (wornStatus === "skipped") return <XCircle className="w-2.5 h-2.5 text-muted-foreground" />;
  if (status === "locked") return <Lock className="w-2.5 h-2.5 text-foreground" />;
  if (status === "planned") return <span className="w-1.5 h-1.5 rounded-full bg-primary" />;
  if (status === "suggested") return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />;
  return null;
}

export default function MonthDateCell({
  dayOfMonth, inCurrentMonth, isToday, isPast,
  items, status, wornStatus, tempC, hasEvents, selected, onClick,
}: Props) {
  const hasItems = items.length > 0;
  const thumbs = items.slice(0, 4);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg border transition-all flex flex-col items-center p-1 min-w-0",
        selected
          ? "border-primary bg-primary/5 min-h-[88px]"
          : "border-transparent hover:border-border min-h-[76px]",
        !inCurrentMonth && "opacity-35",
        isPast && inCurrentMonth && !selected && "opacity-80",
      )}
    >
      {/* Date number + event dot (top) */}
      <div className="flex items-center justify-between w-full px-0.5 h-3.5 shrink-0 leading-none">
        <span
          className={cn(
            "text-[10px] font-semibold font-outfit",
            isToday ? "text-primary" : "text-foreground",
          )}
        >
          {dayOfMonth}
        </span>
        {hasEvents && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent-foreground/70 shrink-0" />
        )}
      </div>

      {/* Thumbnail / collage (middle) */}
      <div className="flex-1 w-full mt-0.5 mb-0.5 rounded-md overflow-hidden min-h-0">
        {hasItems ? (
          thumbs.length === 1 ? (
            <img
              src={thumbs[0].image_url}
              alt=""
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="grid grid-cols-2 gap-px w-full h-full">
              {thumbs.map((g, i) => (
                <img
                  key={g.id || i}
                  src={g.image_url}
                  alt=""
                  className="w-full h-full object-contain bg-background"
                  loading="lazy"
                  decoding="async"
                />
              ))}
              {thumbs.length === 3 && <div className="bg-muted/50" />}
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          </div>
        )}
      </div>

      {/* Weather + status (bottom) */}
      <div className="flex items-center justify-center gap-0.5 h-2.5 shrink-0 leading-none">
        {tempC != null && (
          <span className="text-[8px] text-muted-foreground">{Math.round(tempC)}°</span>
        )}
        <StatusDot status={status} wornStatus={wornStatus} />
      </div>
    </button>
  );
}
