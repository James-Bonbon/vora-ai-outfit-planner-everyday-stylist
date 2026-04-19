import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { sanitizeWardrobeSvg } from "@/utils/sanitizeWardrobeSvg";
import { Grid, Shirt, Server, User, ShoppingBag } from "lucide-react";

interface WardrobeMapProps {
  svgString: string;
  activeZoneId?: string;
  onZoneSelect?: (zoneId: string) => void;
  isSelectionMode?: boolean;
  className?: string;
  /** When true, preserves the SVG's intrinsic aspect ratio (fits inside container) instead of stretching. */
  preserveAspect?: boolean;
}

const ZONE_CONTENT: Record<string, { icon: React.ReactNode; text: string }> = {
  left_shelves: { icon: <Grid className="w-4 h-4 mb-0.5" />, text: "Left Shelving" },
  center_hanging_shirts: { icon: <Shirt className="w-4 h-4 mb-0.5" />, text: "Center Hanging Shirts" },
  center_drawers: { icon: <Server className="w-4 h-4 mb-0.5" />, text: "Center Drawers" },
  right_hanging_dresses: { icon: <User className="w-4 h-4 mb-0.5" />, text: "Right Hanging Dresses" },
  floor_storage: { icon: <ShoppingBag className="w-4 h-4 mb-0.5" />, text: "Floor Bags/Storage" },
};

const parseSvgZones = (svgStr: string) => {
  if (typeof window === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgStr, "image/svg+xml");
  const rects = Array.from(doc.querySelectorAll("rect"));
  return rects
    .map((rect) => {
      const getVal = (attr: string) => parseFloat(rect.getAttribute(attr) || "0") / 10;
      return {
        id: rect.getAttribute("id") || "",
        left: `${getVal("x")}%`,
        top: `${getVal("y")}%`,
        width: `${getVal("width")}%`,
        height: `${getVal("height")}%`,
      };
    })
    .filter((z) => z.id);
};

export const WardrobeMap: React.FC<WardrobeMapProps> = ({
  svgString,
  activeZoneId,
  onZoneSelect,
  isSelectionMode = false,
  className,
  preserveAspect = false,
}) => {
  const sanitizedSvg = useMemo(() => sanitizeWardrobeSvg(svgString), [svgString]);
  const zones = useMemo(() => parseSvgZones(sanitizedSvg || ""), [sanitizedSvg]);

  if (!sanitizedSvg) return null;

  return (
    <div className={cn("w-full flex items-center justify-center p-6 bg-card border border-border/50 rounded-2xl", className)}>
      <div className="relative w-full max-w-[300px] aspect-square">
        <div
          className="absolute inset-0 w-full h-full [&>svg]:w-full [&>svg]:h-full [&_rect]:!fill-transparent [&_rect]:!stroke-foreground/20 [&_rect]:!stroke-[2px]"
          dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
        />
        {zones.map((zone, idx) => {
        const content = ZONE_CONTENT[zone.id];
        if (!content) return null;
        const isActive = activeZoneId === zone.id;
        const dimmed = activeZoneId && !isActive;
        return (
          <div
            key={idx}
            className={cn(
              "absolute flex flex-col items-center justify-center text-foreground p-1 text-center rounded-lg transition-all duration-300",
              isSelectionMode && "cursor-pointer hover:bg-primary/10",
              isActive && "ring-4 ring-primary bg-primary/20",
              dimmed && "opacity-30 grayscale",
            )}
            style={{ left: zone.left, top: zone.top, width: zone.width, height: zone.height }}
            onClick={(e) => {
              if (isSelectionMode && onZoneSelect) {
                e.stopPropagation();
                onZoneSelect(zone.id);
              }
            }}
          >
            {content.icon}
            <span className="text-[9px] sm:text-[10px] font-medium leading-tight">{content.text}</span>
          </div>
        );
      })}
    </div>
  );
};

export default WardrobeMap;
