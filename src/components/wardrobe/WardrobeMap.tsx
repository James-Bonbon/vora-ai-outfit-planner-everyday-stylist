import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface WardrobeMapProps {
  svgString: string;
  activeZoneId?: string;
  onZoneSelect?: (zoneId: string) => void;
  isSelectionMode?: boolean;
  className?: string;
}

const SAGE = "hsl(110, 10%, 38%)"; // flatlay-cta token equivalent

export const WardrobeMap: React.FC<WardrobeMapProps> = ({
  svgString,
  activeZoneId,
  onZoneSelect,
  isSelectionMode = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const applyStyles = useCallback(() => {
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) return;

    svgElement.style.width = "100%";
    svgElement.style.height = "100%";
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgElement.style.pointerEvents = "none";

    const paths = svgElement.querySelectorAll("path, rect, polygon, ellipse, circle");

    paths.forEach((el) => {
      const htmlEl = el as SVGElement & ElementCSSInlineStyle;
      const zoneId = htmlEl.getAttribute("id");

      if (!zoneId) {
        htmlEl.style.pointerEvents = "none";
        htmlEl.style.fill = "transparent";
        htmlEl.style.stroke = "none";
        return;
      }

      // Reset styles
      htmlEl.style.pointerEvents = "auto";
      htmlEl.style.fill = "transparent";
      htmlEl.style.stroke = "hsl(var(--border))";
      htmlEl.style.strokeWidth = "2";
      htmlEl.style.transition = "all 0.3s ease";
      htmlEl.style.cursor = isSelectionMode ? "pointer" : "default";

      // Active zone highlighting
      if (activeZoneId && zoneId === activeZoneId) {
        htmlEl.style.fill = SAGE;
        htmlEl.style.fillOpacity = "0.4";
        htmlEl.style.stroke = SAGE;
        htmlEl.style.strokeWidth = "2.5";
      }

      // Interactive listeners for selection mode
      if (isSelectionMode && onZoneSelect) {
        htmlEl.onmouseenter = () => {
          if (zoneId !== activeZoneId) {
            htmlEl.style.fill = SAGE;
            htmlEl.style.fillOpacity = "0.15";
          }
        };
        htmlEl.onmouseleave = () => {
          if (zoneId !== activeZoneId) {
            htmlEl.style.fill = "transparent";
            htmlEl.style.fillOpacity = "1";
          }
        };
        htmlEl.onclick = (e) => {
          e.stopPropagation();
          onZoneSelect(zoneId);
        };
      }
    });
  }, [svgString, activeZoneId, isSelectionMode, onZoneSelect]);

  useEffect(() => {
    applyStyles();
  }, [applyStyles]);

  if (!svgString) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 w-full h-full z-10",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

export default WardrobeMap;
