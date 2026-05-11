/**
 * MonthDateCell — ultra-compact date cell for the month grid.
 *
 * Optimized for 7-column mobile grids. Renders a single thumbnail (the first
 * garment image) instead of a full collage to keep the month view fast.
 */

import { Lock, CheckCircle2, XCircle } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
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
  const thumb = items[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-lg border transition-all flex flex-col items-center justify-between p-1 min-w-0",
        selected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-border",
        !inCurrentMonth && "opacity-35",
        isPast && inCurrentMonth && !selected && "opacity-80",
      )}
    >
      {/* Date number (top) */}
      <div className="flex items-center justify-between w-full px-0.5 leading-none">
        <span
          className={cn(
            "text-[11px] font-semibold font-outfit",
            isToday ? "text-primary" : "text-foreground",
          )}
        >
          {dayOfMonth}
        </span>
        {hasEvents && <span className="w-1 h-1 rounded-full bg-accent-foreground/70" />}
      </div>

      {/* Thumbnail / placeholder (middle) */}
      <div
        className={cn(
          "flex-1 w-full mt-0.5 rounded-md overflow-hidden flex items-center justify-center",
          hasItems ? "bg-background" : "bg-muted/40",
        )}
      >
        {hasItems && thumb ? (
          <SafeImage src={thumb.image_url} alt="" fit="contain" />
        ) : null}
      </div>

      {/* Bottom indicator row */}
      <div className="flex items-center justify-center gap-0.5 h-2.5 mt-0.5 leading-none">
        {tempC != null && (
          <span className="text-[8px] text-muted-foreground">{Math.round(tempC)}°</span>
        )}
        <StatusDot status={status} wornStatus={wornStatus} />
      </div>
    </button>
  );
}
