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

export const MOCK_SVG = `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><rect id="top_left" x="50" y="50" width="400" height="400" /><rect id="bottom_left" x="50" y="470" width="400" height="480" /><rect id="top_right" x="470" y="50" width="480" height="400" /><rect id="bottom_right" x="470" y="470" width="480" height="480" /></svg>`;

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
        </div>
      )}
    </div>
  );
};

export default WardrobeViewer;
