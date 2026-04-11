import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WardrobeMap } from "./WardrobeMap";
import type { Wardrobe } from "@/types/wardrobe";

interface WardrobeViewerProps {
  wardrobe: Wardrobe;
  activeZoneId?: string;
  onZoneSelect?: (zoneId: string) => void;
  isSelectionMode?: boolean;
}

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

  if (!wardrobe.views.length) return null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
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
        <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <img
            src={activeView.imageUrl}
            alt={activeView.name}
            className="w-full h-auto block object-cover"
          />
          <WardrobeMap
            svgString={activeView.svgString}
            activeZoneId={activeZoneId}
            onZoneSelect={onZoneSelect}
            isSelectionMode={isSelectionMode}
          />
        </div>
      )}
    </div>
  );
};

export default WardrobeViewer;
