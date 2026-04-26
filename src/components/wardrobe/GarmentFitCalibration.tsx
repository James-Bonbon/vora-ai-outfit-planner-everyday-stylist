import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  itemId: string;
  imageUrl: string;
  layoutMetadata: any;
  imageAnalysis: any;
  onSaved: () => void;
};

const editableKeys = ["leftUpperFitAnchor", "rightUpperFitAnchor", "leftWaistAnchor", "rightWaistAnchor"] as const;

const getInitialAnchors = (metadata: any) => ({
  leftUpperFitAnchor: metadata?.validatedMeasurementAnchors?.upperFit?.leftUpperFitAnchor || metadata?.measurementAnchors?.upperFit?.leftUpperFitAnchor || metadata?.layoutAnchors?.upperFit?.leftUpperFitAnchor || metadata?.leftUpperAnchor,
  rightUpperFitAnchor: metadata?.validatedMeasurementAnchors?.upperFit?.rightUpperFitAnchor || metadata?.measurementAnchors?.upperFit?.rightUpperFitAnchor || metadata?.layoutAnchors?.upperFit?.rightUpperFitAnchor || metadata?.rightUpperAnchor,
  leftWaistAnchor: metadata?.validatedMeasurementAnchors?.waist?.leftWaistAnchor || metadata?.measurementAnchors?.waist?.leftWaistAnchor || metadata?.leftWaistAnchor,
  rightWaistAnchor: metadata?.validatedMeasurementAnchors?.waist?.rightWaistAnchor || metadata?.measurementAnchors?.waist?.rightWaistAnchor || metadata?.rightWaistAnchor,
});

export const GarmentFitCalibration = ({ itemId, imageUrl, layoutMetadata, imageAnalysis, onSaved }: Props) => {
  const queryClient = useQueryClient();
  const [anchors, setAnchors] = useState(getInitialAnchors(layoutMetadata));
  const [dragging, setDragging] = useState<keyof typeof anchors | null>(null);
  const [saving, setSaving] = useState(false);
  const imageWidth = Number(imageAnalysis?.imageWidth) || 1;
  const imageHeight = Number(imageAnalysis?.imageHeight) || 1;

  const groups = useMemo(() => {
    const upperWidth = anchors.leftUpperFitAnchor && anchors.rightUpperFitAnchor ? Math.abs(anchors.rightUpperFitAnchor.x - anchors.leftUpperFitAnchor.x) : undefined;
    const waistWidth = anchors.leftWaistAnchor && anchors.rightWaistAnchor ? Math.abs(anchors.rightWaistAnchor.x - anchors.leftWaistAnchor.x) : undefined;
    return {
      upperFit: anchors.leftUpperFitAnchor && anchors.rightUpperFitAnchor ? {
        leftUpperFitAnchor: { ...anchors.leftUpperFitAnchor, source: "human", confidence: 1, notes: "Human calibrated anchor." },
        rightUpperFitAnchor: { ...anchors.rightUpperFitAnchor, source: "human", confidence: 1, notes: "Human calibrated anchor." },
        upperBodyFitWidth: upperWidth,
        source: "human",
        confidence: 1,
        notes: "Human-approved upper fit width.",
      } : undefined,
      waist: anchors.leftWaistAnchor && anchors.rightWaistAnchor ? {
        leftWaistAnchor: { ...anchors.leftWaistAnchor, source: "human", confidence: 1, notes: "Human calibrated anchor." },
        rightWaistAnchor: { ...anchors.rightWaistAnchor, source: "human", confidence: 1, notes: "Human calibrated anchor." },
        waistFitWidth: waistWidth,
        source: "human",
        confidence: 1,
        notes: "Human-approved waist fit width.",
      } : undefined,
    };
  }, [anchors]);

  const updateFromPointer = (key: keyof typeof anchors, event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchors((prev) => ({
      ...prev,
      [key]: {
        x: Math.max(0, Math.min(imageWidth, ((event.clientX - rect.left) / rect.width) * imageWidth)),
        y: Math.max(0, Math.min(imageHeight, ((event.clientY - rect.top) / rect.height) * imageHeight)),
        source: "human",
        confidence: 1,
        notes: "Human calibrated anchor.",
      },
    }));
  };

  const addAnchor = (key: keyof typeof anchors) => {
    const defaults: Record<keyof typeof anchors, { x: number; y: number }> = {
      leftUpperFitAnchor: { x: imageWidth * 0.34, y: imageHeight * 0.2 },
      rightUpperFitAnchor: { x: imageWidth * 0.66, y: imageHeight * 0.2 },
      leftWaistAnchor: { x: imageWidth * 0.38, y: imageHeight * 0.48 },
      rightWaistAnchor: { x: imageWidth * 0.62, y: imageHeight * 0.48 },
    };
    setAnchors((prev) => ({
      ...prev,
      [key]: { ...defaults[key], source: "human", confidence: 1, notes: "Human calibrated anchor." },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validatedMeasurementAnchors = Object.fromEntries(Object.entries(groups).filter(([, value]) => Boolean(value)));
      const staleLayoutAnchors = { ...(layoutMetadata?.layoutAnchors || {}) };
      if (validatedMeasurementAnchors.upperFit) delete staleLayoutAnchors.upperFit;
      if (validatedMeasurementAnchors.waist) delete staleLayoutAnchors.waist;
      const humanUpper = validatedMeasurementAnchors.upperFit as any;
      const humanWaist = validatedMeasurementAnchors.waist as any;
      const nextMetadata = {
        ...(layoutMetadata || {}),
        validatedMeasurementAnchors,
        measurementAnchors: validatedMeasurementAnchors,
        layoutAnchors: staleLayoutAnchors,
        leftUpperAnchor: humanUpper?.leftUpperFitAnchor || layoutMetadata?.leftUpperAnchor,
        rightUpperAnchor: humanUpper?.rightUpperFitAnchor || layoutMetadata?.rightUpperAnchor,
        upperBodyWidthAnchor: humanUpper?.upperBodyFitWidth ?? layoutMetadata?.upperBodyWidthAnchor,
        leftWaistAnchor: humanWaist?.leftWaistAnchor || layoutMetadata?.leftWaistAnchor,
        rightWaistAnchor: humanWaist?.rightWaistAnchor || layoutMetadata?.rightWaistAnchor,
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
      toast.success("Fit calibration saved");
      onSaved();
    } catch (error) {
      console.error("Calibration save failed", error);
      toast.error("Failed to save calibration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Garment Fit Intelligence</h3>
        <Button size="sm" className="h-8 rounded-xl gap-1" onClick={handleSave} disabled={saving}>
          <Check className="h-3 w-3" /> Save
        </Button>
      </div>
      <div
        className="relative aspect-square overflow-hidden rounded-xl bg-flatlay touch-none"
        onPointerMove={(event) => dragging && updateFromPointer(dragging, event)}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <img src={imageUrl} alt="Garment calibration" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        {editableKeys.map((key) => {
          const point = anchors[key];
          if (!point) return null;
          const left = `${(point.x / imageWidth) * 100}%`;
          const top = `${(point.y / imageHeight) * 100}%`;
          return (
            <button
              key={key}
              type="button"
              className="absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
              style={{ left, top }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(key);
              }}
              aria-label={key}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        {editableKeys.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg bg-background px-2 py-1">
            <span>{key.replace("Anchor", "")}</span>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => anchors[key] ? setAnchors((prev) => ({ ...prev, [key]: undefined })) : addAnchor(key)}>
              {anchors[key] ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GarmentFitCalibration;