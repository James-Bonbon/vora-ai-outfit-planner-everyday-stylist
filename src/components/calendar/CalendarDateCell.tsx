/**
 * CalendarDateCell — compact date cell for the week grid in OutfitCalendarSheet.
 *
 * Shows: day label, date number, tiny weather/occasion dot, small outfit
 * thumbnail (first 1–4 garments), and a status indicator pill.
 */

import { format } from "date-fns";
import { Lock, CheckCircle2, XCircle } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import type { StylingItem } from "@/utils/stylingEngine";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  dateKind: "past" | "today" | "future";
  items: StylingItem[];
  status: string;
  wornStatus?: "worn" | "skipped" | null;
  tempC?: number | null;
  hasEvents?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function StatusDot({ status, wornStatus }: { status: string; wornStatus?: "worn" | "skipped" | null }) {
  if (wornStatus === "worn") {
    return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
  }
  if (wornStatus === "skipped") {
    return <XCircle className="w-3 h-3 text-muted-foreground" />;
  }
  if (status === "locked") return <Lock className="w-3 h-3 text-foreground" />;
  if (status === "planned") return <span className="w-1.5 h-1.5 rounded-full bg-primary" />;
  if (status === "suggested") return <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />;
  return null;
}

export default function CalendarDateCell({
  date, dateKind, items, status, wornStatus, tempC, hasEvents, selected, onClick,
}: Props) {
  const hasItems = items.length > 0;
  const thumbs = items.slice(0, 4);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all min-w-0",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-transparent hover:border-border bg-transparent",
        dateKind === "past" && !selected && "opacity-75",
      )}
    >
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium leading-none">
        {format(date, "EEE")}
      </span>
      <span
        className={cn(
          "text-sm font-bold leading-none font-outfit",
          dateKind === "today" ? "text-primary" : "text-foreground",
        )}
      >
        {format(date, "d")}
      </span>

      {/* Thumbnail area — 3:4 ratio */}
      <div
        className={cn(
          "relative w-full aspect-[3/4] rounded-lg overflow-hidden mt-0.5",
          hasItems ? "bg-background" : "bg-muted",
        )}
      >
        {hasItems ? (
          thumbs.length === 1 ? (
            <SafeImage src={thumbs[0].image_url} alt="" fit="contain" />
          ) : (
            <div className="grid grid-cols-2 gap-px w-full h-full">
              {thumbs.map((g, i) => (
                <div key={g.id || i} className="bg-background overflow-hidden">
                  <SafeImage src={g.image_url} alt="" fit="contain" />
                </div>
              ))}
              {thumbs.length === 3 && <div className="bg-muted/50" />}
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {hasEvents && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-foreground/70" />
        )}
      </div>

      {/* Bottom indicator row */}
      <div className="flex items-center justify-center gap-1 h-3 mt-0.5">
        {tempC != null && (
          <span className="text-[9px] text-muted-foreground leading-none">{Math.round(tempC)}°</span>
        )}
        <StatusDot status={status} wornStatus={wornStatus} />
      </div>
    </button>
  );
}
