import React, { useMemo } from "react";
import { Grid, Shirt, Server, User, ShoppingBag } from "lucide-react";

const ZONE_CONFIG: Record<string, { label: string; Icon: React.FC<{ className?: string }> }> = {
  left_shelves: { label: "Left Shelving", Icon: Grid },
  center_hanging_shirts: { label: "Center Hanging Shirts", Icon: Shirt },
  center_drawers: { label: "Center Drawers", Icon: Server },
  right_hanging_dresses: { label: "Right Hanging Dresses", Icon: User },
  floor_storage: { label: "Floor Bags/Storage", Icon: ShoppingBag },
};

interface ZoneRect {
  id: string;
  left: string;
  top: string;
  width: string;
  height: string;
}

function parseZones(svgString: string): ZoneRect[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const zones: ZoneRect[] = [];

  for (const id of Object.keys(ZONE_CONFIG)) {
    const rect = doc.querySelector(`rect[id="${id}"]`);
    if (!rect) continue;

    const x = Number(rect.getAttribute("x"));
    const y = Number(rect.getAttribute("y"));
    const w = Number(rect.getAttribute("width"));
    const h = Number(rect.getAttribute("height"));

    if ([x, y, w, h].some(Number.isNaN)) continue;

    zones.push({
      id,
      left: `${x / 10}%`,
      top: `${y / 10}%`,
      width: `${w / 10}%`,
      height: `${h / 10}%`,
    });
  }

  return zones;
}

interface Props {
  svgString: string;
}

const WardrobeHybridOverlay: React.FC<Props> = ({ svgString }) => {
  const zones = useMemo(() => parseZones(svgString), [svgString]);

  return (
    <div className="relative w-full aspect-square max-h-[60vh]">
      {/* Base Layer – AI grid */}
      <div
        className="absolute inset-0
                   [&>svg]:w-full [&>svg]:h-full
                   [&_rect]:!fill-transparent [&_rect]:!stroke-foreground [&_rect]:!stroke-[2px]
                   [&_text]:!hidden [&_path]:!hidden [&_circle]:!hidden"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />

      {/* Overlay Layer – Lucide icons + labels */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {zones.map(({ id, left, top, width, height }) => {
          const config = ZONE_CONFIG[id];
          if (!config) return null;
          const { Icon, label } = config;

          return (
            <div
              key={id}
              className="absolute flex flex-col items-center justify-center text-foreground gap-1"
              style={{ left, top, width, height }}
            >
              <Icon className="w-5 h-5 opacity-80" />
              <span className="text-[10px] font-medium text-center leading-tight opacity-80">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WardrobeHybridOverlay;
