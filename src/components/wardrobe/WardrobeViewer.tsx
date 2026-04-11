import React, { useMemo, useState } from "react";
import { Grid, Server, Shirt, ShoppingBag, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WardrobeMap } from "./WardrobeMap";
import type { Wardrobe } from "@/types/wardrobe";

interface WardrobeViewerProps {
  wardrobe: Wardrobe;
  activeZoneId?: string;
  onZoneSelect?: (zoneId: string) => void;
  isSelectionMode?: boolean;
}

type ZoneLabelId =
  | "left_shelves"
  | "center_hanging_shirts"
  | "center_drawers"
  | "right_hanging_dresses"
  | "floor_storage";

const ZONE_LABELS: Record<ZoneLabelId, { label: string; Icon: typeof Grid }> = {
  left_shelves: {
    label: "Left Shelving",
    Icon: Grid,
  },
  center_hanging_shirts: {
    label: "Center Hanging Shirts",
    Icon: Shirt,
  },
  center_drawers: {
    label: "Center Drawers",
    Icon: Server,
  },
  right_hanging_dresses: {
    label: "Right Hanging Dresses",
    Icon: User,
  },
  floor_storage: {
    label: "Floor Bags/Storage",
    Icon: ShoppingBag,
  },
};

const WardrobeViewer: React.FC<WardrobeViewerProps> = ({
  wardrobe,
  activeZoneId,
  onZoneSelect,
  isSelectionMode = false,
}) => {
  const [activeViewId, setActiveViewId] = useState(
    wardrobe.views[0]?.id ?? ""
  );

  const activeView = wardrobe.views.find((v) => v.id === activeViewId);

  const zoneOverlays = useMemo(() => {
    if (!activeView?.svgString || typeof DOMParser === "undefined") return [];

    const doc = new DOMParser().parseFromString(activeView.svgString, "image/svg+xml");

    return (Object.keys(ZONE_LABELS) as ZoneLabelId[]).flatMap((zoneId) => {
      const rect = doc.querySelector(`rect[id="${zoneId}"]`);
      if (!rect) return [];

      const x = Number(rect.getAttribute("x"));
      const y = Number(rect.getAttribute("y"));
      const width = Number(rect.getAttribute("width"));
      const height = Number(rect.getAttribute("height"));

      if ([x, y, width, height].some((value) => Number.isNaN(value))) return [];

      return [
        {
          id: zoneId,
          label: ZONE_LABELS[zoneId].label,
          Icon: ZONE_LABELS[zoneId].Icon,
          left: `${x / 10}%`,
          top: `${y / 10}%`,
          width: `${width / 10}%`,
          height: `${height / 10}%`,
        },
      ];
    });
  }, [activeView?.svgString]);

  if (!wardrobe.views.length) return null;

  return (
    <div className="w-full space-y-3">
      {/* View toggle tabs — only show if multiple views */}
      {wardrobe.views.length > 1 && (
        <Tabs value={activeViewId} onValueChange={setActiveViewId}>
          <TabsList className="w-full">
            {wardrobe.views.map((view) => (
              <TabsTrigger key={view.id} value={view.id} className="flex-1">
                {view.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Visual container — image + SVG overlay */}
      {activeView && (
        <div className="relative w-full max-w-2xl mx-auto min-h-[50vh] rounded-xl overflow-hidden shadow-md bg-card">
          <img
            src={activeView.imageUrl}
            alt={activeView.name}
            className="w-full h-auto block"
          />
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <WardrobeMap
              svgString={activeView.svgString}
              activeZoneId={activeZoneId}
              onZoneSelect={onZoneSelect}
              isSelectionMode={isSelectionMode}
            />
          </div>
          <div className="absolute inset-0 pointer-events-none z-20">
            {zoneOverlays.map(({ id, label, Icon, left, top, width, height }) => (
              <div
                key={id}
                className="absolute flex flex-col items-center justify-center text-primary-foreground font-medium text-sm drop-shadow-md"
                style={{ left, top, width, height }}
              >
                <Icon size={24} className="mb-2" />
                <span className="text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeViewer;
