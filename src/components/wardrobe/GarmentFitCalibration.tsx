import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  projectFitBoxToRenderedImage,
  unprojectPointToSourceImage,
  getObjectContainRect,
} from "@/utils/garmentFitIntelligence";

type FitBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  source: "human" | "ai" | "alpha_profile" | "ratio_guard";
  confidence: number;
  validationStatus: "validated" | "estimated" | "failed" | "warning";
  notes?: string;
};

type Props = {
  itemId: string;
  imageUrl: string;
  layoutMetadata: any;
  imageAnalysis: any;
  onSaved: () => void;
};

type DragMode = "move" | "left" | "right" | "top" | "bottom" | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getDefaultFitBox = (metadata: any, analysis: any): FitBox => {
  const imageWidth = Number(analysis?.imageWidth) || 1;
  const imageHeight = Number(analysis?.imageHeight) || 1;
  const existing = metadata?.fitBox;
  if (existing && Number(existing.width) > 0 && Number(existing.height) > 0) {
    return {
      x: Number(existing.x),
      y: Number(existing.y),
      width: Number(existing.width),
      height: Number(existing.height),
      source: existing.source || "ai",
      confidence: Number(existing.confidence ?? 0.5),
      validationStatus: existing.validationStatus || "estimated",
      notes: existing.notes,
    };
  }
  const b = analysis?.visibleAlphaBounds || {
    x: Number(analysis?.visibleX) || imageWidth * 0.15,
    y: Number(analysis?.visibleY) || imageHeight * 0.08,
    width: Number(analysis?.visibleWidth) || imageWidth * 0.7,
    height: Number(analysis?.visibleHeight) || imageHeight * 0.84,
  };
  const familyText = `${metadata?.garmentType ?? ""}`.toLowerCase();
  const isBottom = /trouser|pant|jean|skirt|short|legging/.test(familyText);
  const y = b.y + b.height * (isBottom ? 0.06 : 0.16);
  const width = b.width * (isBottom ? 0.52 : 0.56);
  return {
    x: b.x + (b.width - width) / 2,
    y,
    width,
    height: b.y + b.height - y,
    source: "alpha_profile",
    confidence: 0.5,
    validationStatus: "estimated",
    notes: "Initial fitBox estimate.",
  };
};

export const GarmentFitCalibration = ({ itemId, imageUrl, layoutMetadata, imageAnalysis, onSaved }: Props) => {
  const queryClient = useQueryClient();
  const imageWidth = Number(imageAnalysis?.imageWidth) || 1;
  const imageHeight = Number(imageAnalysis?.imageHeight) || 1;
  const [fitBox, setFitBox] = useState<FitBox>(() => getDefaultFitBox(layoutMetadata, imageAnalysis));
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [wrapperSize, setWrapperSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const debugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("outfitDebugAnchors") === "1";

  const setWrapperRef = (node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setWrapperSize({ width: rect.width, height: rect.height });
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        setWrapperSize({ width, height });
      });
      observer.observe(node);
    }
  };

  // Project the canonical source-image-pixel fitBox into the rendered image rect
  // inside the wrapper. This MUST mirror OutfitCollage's projection so the same
  // saved fitBox covers the same garment pixels in both surfaces.
  const projected = useMemo(() => {
    if (wrapperSize.width <= 0 || wrapperSize.height <= 0) return null;
    return projectFitBoxToRenderedImage(fitBox, imageAnalysis, wrapperSize.width, wrapperSize.height);
  }, [fitBox, imageAnalysis, wrapperSize.width, wrapperSize.height]);

  const renderedImageRect = useMemo(() => {
    if (wrapperSize.width <= 0 || wrapperSize.height <= 0) return null;
    return getObjectContainRect(wrapperSize.width, wrapperSize.height, imageWidth, imageHeight);
  }, [wrapperSize.width, wrapperSize.height, imageWidth, imageHeight]);

  const warning = useMemo(() => {
    if (fitBox.source === "human" && layoutMetadata?.fitBox?.validationStatus === "warning") return layoutMetadata?.fitBox?.notes;
    return fitBox.validationStatus === "failed" || fitBox.validationStatus === "warning" ? fitBox.notes : null;
  }, [fitBox, layoutMetadata]);

  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const sourcePoint = unprojectPointToSourceImage(localX, localY, imageAnalysis, rect.width, rect.height);
    if (!sourcePoint) return;
    const x = sourcePoint.x;
    const y = sourcePoint.y;
    setFitBox((prev) => {
      if (dragMode === "move") {
        const nextX = clamp(x - prev.width / 2, 0, imageWidth - prev.width);
        const nextY = clamp(y - prev.height / 2, 0, imageHeight - prev.height);
        return { ...prev, x: nextX, y: nextY };
      }
      if (dragMode === "left") {
        const right = prev.x + prev.width;
        const nextX = clamp(x, 0, right - 12);
        return { ...prev, x: nextX, width: right - nextX };
      }
      if (dragMode === "right") return { ...prev, width: clamp(x - prev.x, 12, imageWidth - prev.x) };
      if (dragMode === "top") {
        const bottom = prev.y + prev.height;
        const nextY = clamp(y, 0, bottom - 12);
        return { ...prev, y: nextY, height: bottom - nextY };
      }
      if (dragMode === "bottom") return { ...prev, height: clamp(y - prev.y, 12, imageHeight - prev.y) };
      return prev;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const humanFitBox: FitBox = {
        x: fitBox.x,
        y: fitBox.y,
        width: fitBox.width,
        height: fitBox.height,
        source: "human",
        confidence: 1,
        validationStatus: "validated",
        notes: "Human calibrated fitBox (canonical source-image pixels).",
      };
      const nextMetadata = {
        ...(layoutMetadata || {}),
        fitBox: humanFitBox,
        fitValidation: { status: "human", rejected: [] },
        confidence: 1,
      };
      const { error } = await supabase.from("closet_items").update({ layout_metadata: nextMetadata }).eq("id", itemId);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["closet"] }),
        queryClient.invalidateQueries({ queryKey: ["closet-items"] }),
        queryClient.invalidateQueries({ queryKey: ["lookbook"] }),
        queryClient.invalidateQueries({ queryKey: ["outfit-calendar-data"] }),
        queryClient.invalidateQueries({ queryKey: ["look-garments"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-looks"] }),
      ]);
      toast.success("Fit box saved");
      onSaved();
    } catch (error) {
      console.error("Calibration save failed", error);
      toast.error("Failed to save fit box");
    } finally {
      setSaving(false);
    }
  };

  const overlayStyle = projected && projected.width > 0 && projected.height > 0
    ? {
        left: `${(projected.left / Math.max(wrapperSize.width, 1)) * 100}%`,
        top: `${(projected.top / Math.max(wrapperSize.height, 1)) * 100}%`,
        width: `${(projected.width / Math.max(wrapperSize.width, 1)) * 100}%`,
        height: `${(projected.height / Math.max(wrapperSize.height, 1)) * 100}%`,
      }
    : { left: "0%", top: "0%", width: "0%", height: "0%" };

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Garment Fit Intelligence</h3>
          <p className="text-[11px] text-muted-foreground">Fit box: {fitBox.source} · {fitBox.confidence.toFixed(2)}</p>
        </div>
        <Button size="sm" className="h-8 rounded-xl gap-1" onClick={handleSave} disabled={saving}>
          <Check className="h-3 w-3" /> Save
        </Button>
      </div>
      <div
        ref={setWrapperRef}
        className="relative aspect-square overflow-hidden rounded-xl bg-flatlay touch-none"
        onPointerMove={updateFromPointer}
        onPointerUp={() => setDragMode(null)}
        onPointerLeave={() => setDragMode(null)}
      >
        <img src={imageUrl} alt="Garment calibration" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        <button
          type="button"
          className="absolute z-10 cursor-move border-2 border-primary bg-primary/10"
          style={overlayStyle}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragMode("move");
          }}
          aria-label="Move fit box"
        >
          {(["left", "right", "top", "bottom"] as const).map((mode) => (
            <span
              key={mode}
              className={mode === "left" || mode === "right" ? "absolute top-1/2 h-8 w-3 -translate-y-1/2 rounded-full bg-primary" : "absolute left-1/2 h-3 w-8 -translate-x-1/2 rounded-full bg-primary"}
              style={mode === "left" ? { left: "-0.4rem" } : mode === "right" ? { right: "-0.4rem" } : mode === "top" ? { top: "-0.4rem" } : { bottom: "-0.4rem" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                (event.currentTarget.parentElement as HTMLElement).setPointerCapture(event.pointerId);
                setDragMode(mode);
              }}
            />
          ))}
        </button>
        {debugEnabled && renderedImageRect && (
          <div
            className="pointer-events-none absolute border border-dashed border-accent/60"
            style={{
              left: `${(renderedImageRect.left / Math.max(wrapperSize.width, 1)) * 100}%`,
              top: `${(renderedImageRect.top / Math.max(wrapperSize.height, 1)) * 100}%`,
              width: `${(renderedImageRect.width / Math.max(wrapperSize.width, 1)) * 100}%`,
              height: `${(renderedImageRect.height / Math.max(wrapperSize.height, 1)) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
      {debugEnabled && (
        <pre className="overflow-x-auto rounded-lg bg-muted/40 p-2 text-[10px] leading-tight text-muted-foreground">
{JSON.stringify({
  canonicalFitBox: { x: Math.round(fitBox.x), y: Math.round(fitBox.y), width: Math.round(fitBox.width), height: Math.round(fitBox.height) },
  imageAnalysis: { imageWidth, imageHeight },
  wrapper: { width: Math.round(wrapperSize.width), height: Math.round(wrapperSize.height) },
  renderedImageRect: renderedImageRect ? { left: Math.round(renderedImageRect.left), top: Math.round(renderedImageRect.top), width: Math.round(renderedImageRect.width), height: Math.round(renderedImageRect.height) } : null,
  projectedFitBox: projected ? { left: Math.round(projected.left), top: Math.round(projected.top), width: Math.round(projected.width), height: Math.round(projected.height) } : null,
}, null, 2)}
        </pre>
      )}
      {warning && <p className="rounded-lg bg-secondary/30 px-2 py-1 text-[11px] text-muted-foreground">{warning}</p>}
    </div>
  );
};

export default GarmentFitCalibration;
