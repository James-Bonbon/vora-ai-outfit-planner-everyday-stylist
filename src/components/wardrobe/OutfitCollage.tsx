import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type OutfitCollageProps = {
  garments: any[];
  debugAnchors?: boolean;
};

type VisualCategory = "shoes" | "bottoms" | "tops" | "outerwear" | "dresses" | "hats" | "accessories";
type BodyCoverage = "full_body" | "upper_body" | "lower_body" | "feet" | "accessory";

type ImageAnalysis = {
  imageWidth?: number;
  imageHeight?: number;
  visibleX?: number;
  visibleY?: number;
  visibleWidth?: number;
  visibleHeight?: number;
  visibleWidthRatio?: number;
  visibleHeightRatio?: number;
};

type LayoutMetadata = {
  garmentType?: string;
  bodyCoverage?: BodyCoverage;
  lengthClass?: string;
  bulkClass?: string;
  preferredPreviewScale?: number;
  leftUpperAnchor?: { x: number; y: number };
  rightUpperAnchor?: { x: number; y: number };
  leftWaistAnchor?: { x: number; y: number };
  rightWaistAnchor?: { x: number; y: number };
  upperBodyWidthAnchor?: number;
  necklineCenter?: { x: number; y: number };
  waistCenter?: { x: number; y: number };
  hemCenter?: { x: number; y: number };
  confidence?: number;
  anchorNormalization?: string;
  anchorSources?: Record<string, "ai" | "alpha_profile" | "alpha_estimate" | "ratio_guard" | string>;
  rawAiLandmarks?: any;
  validatedMeasurementAnchors?: {
    upperFit?: {
      leftUpperFitAnchor?: { x: number; y: number };
      rightUpperFitAnchor?: { x: number; y: number };
      upperBodyFitWidth?: number;
      confidence?: number;
      source?: string;
      notes?: string;
    };
    waist?: {
      leftWaistAnchor?: { x: number; y: number };
      rightWaistAnchor?: { x: number; y: number };
      waistWidth?: number;
      confidence?: number;
      source?: string;
      notes?: string;
    };
  };
  measurementAnchors?: LayoutMetadata["validatedMeasurementAnchors"];
  layoutAnchors?: {
    upperFit?: {
      leftUpperFitAnchor?: { x: number; y: number };
      rightUpperFitAnchor?: { x: number; y: number };
      upperBodyFitWidth?: number;
      confidence?: number;
      source?: string;
      normalizationReason?: string;
      notes?: string;
    };
    waist?: {
      leftWaistAnchor?: { x: number; y: number };
      rightWaistAnchor?: { x: number; y: number };
      waistFitWidth?: number;
      confidence?: number;
      source?: string;
      notes?: string;
    };
    length?: {
      confidence?: number;
      source?: string;
      notes?: string;
      hemFitWidth?: number;
    };
  };
  bodyAnchors?: {
    leftShoulder?: { x: number; y: number };
    rightShoulder?: { x: number; y: number };
    necklineCenter?: { x: number; y: number };
    waistCenter?: { x: number; y: number };
    hemCenter?: { x: number; y: number };
  };
};

type NormalizedRenderStyle = CSSProperties & {
  boxWidthPct: number;
  boxHeightPct: number;
  anchorShiftXPct: number;
  anchorShiftYPct: number;
  rotationDeg: number;
  fitSource?: string;
  upperFitWidthRatio?: number | null;
  targetRenderedFitWidth?: number | null;
  calculatedImageBoxWidth?: number | null;
  finalRenderedFitWidth?: number | null;
};

const centeredOffsets = [
  { x: 0, y: 0 },
  { x: 16, y: 16 },
  { x: -16, y: 24 },
  { x: 24, y: -8 },
];

const classifyGarment = (garment: any): VisualCategory => {
  const text = `${garment?.category ?? ""} ${garment?.name ?? ""}`.toLowerCase();

  if (/\b(hat|cap|beanie|beret|fedora|bucket)\b/.test(text)) return "hats";
  if (/\b(bag|purse|tote|clutch|backpack|handbag|accessor|belt|scarf|jewelry|jewellery|sunglasses)\b/.test(text)) return "accessories";
  if (/\b(shoe|sneaker|boot|heel|loafer|sandal|trainer)\b/.test(text)) return "shoes";
  if (/\b(dress|dresses|gown|jumpsuit|romper|one[-\s]?piece)\b/.test(text)) return "dresses";
  if (/\b(outerwear|jacket|coat|blazer|trench|parka|cardigan|shacket)\b/.test(text)) return "outerwear";
  if (/\b(bottom|trouser|pant|jean|skirt|short|chino|sweatpant|legging)\b/.test(text)) return "bottoms";
  return "tops";
};

const getImageUrl = (garment: any) => garment?.image_url || garment?.thumbnail_url || garment?.url || "";

const visualOrder: Record<VisualCategory, number> = {
  outerwear: 1,
  dresses: 2,
  tops: 3,
  bottoms: 4,
  shoes: 5,
  hats: 6,
  accessories: 7,
};

const stackLayouts = [
  { x: 18, y: 8, rotate: -5, zIndex: 10 },
  { x: 30, y: 18, rotate: 3, zIndex: 20 },
  { x: 42, y: 28, rotate: -2, zIndex: 30 },
  { x: 20, y: 42, rotate: 4, zIndex: 40 },
  { x: 48, y: 56, rotate: -7, zIndex: 50 },
  { x: 8, y: 58, rotate: 6, zIndex: 60 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const inferMetadata = (garment: any, visualCategory: VisualCategory): LayoutMetadata => {
  if (garment?.layout_metadata) return garment.layout_metadata;
  if (visualCategory === "outerwear") return { garmentType: "coat", bodyCoverage: "full_body", lengthClass: "knee", bulkClass: "bulky", preferredPreviewScale: 0.9 };
  if (visualCategory === "dresses") return { garmentType: "dress", bodyCoverage: "full_body", lengthClass: "midi", bulkClass: "medium", preferredPreviewScale: 0.86 };
  if (visualCategory === "bottoms") return { garmentType: "trousers", bodyCoverage: "lower_body", lengthClass: "full_length", bulkClass: "medium", preferredPreviewScale: 0.72 };
  if (visualCategory === "shoes") return { garmentType: "shoes", bodyCoverage: "feet", lengthClass: "cropped", bulkClass: "medium", preferredPreviewScale: 0.36 };
  if (visualCategory === "hats" || visualCategory === "accessories") return { garmentType: "accessory", bodyCoverage: "accessory", lengthClass: "cropped", bulkClass: "light", preferredPreviewScale: 0.32 };
  return { garmentType: "shirt", bodyCoverage: "upper_body", lengthClass: "hip", bulkClass: "light", preferredPreviewScale: 0.56 };
};

const estimateBodyAnchors = (analysis: ImageAnalysis | null | undefined, visualCategory: VisualCategory): LayoutMetadata["bodyAnchors"] | undefined => {
  if (!analysis?.imageWidth || !analysis?.imageHeight || !analysis.visibleWidth || !analysis.visibleHeight) return undefined;
  if (!(["outerwear", "dresses", "tops"] as VisualCategory[]).includes(visualCategory)) return undefined;
  const left = (analysis.visibleX ?? 0) / analysis.imageWidth;
  const top = (analysis.visibleY ?? 0) / analysis.imageHeight;
  const width = analysis.visibleWidth / analysis.imageWidth;
  const height = analysis.visibleHeight / analysis.imageHeight;
  const centerX = left + width / 2;
  const shoulderFactor = visualCategory === "outerwear" ? 0.78 : visualCategory === "dresses" ? 0.72 : 0.7;
  const shoulderY = top + height * (visualCategory === "outerwear" ? 0.18 : 0.16);
  const halfShoulder = (width * shoulderFactor) / 2;

  return {
    leftShoulder: { x: clamp(centerX - halfShoulder, 0, 1), y: clamp(shoulderY, 0, 1) },
    rightShoulder: { x: clamp(centerX + halfShoulder, 0, 1), y: clamp(shoulderY, 0, 1) },
    necklineCenter: { x: centerX, y: clamp(top + height * 0.12, 0, 1) },
    waistCenter: { x: centerX, y: clamp(top + height * (visualCategory === "dresses" ? 0.46 : 0.58), 0, 1) },
    hemCenter: { x: centerX, y: clamp(top + height * 0.94, 0, 1) },
  };
};

const getTargetVisibleHeight = (visualCategory: VisualCategory, metadata: LayoutMetadata, coatHeight?: number) => {
  if (visualCategory === "outerwear") return metadata.garmentType === "jacket" ? 58 : 64;
  if (visualCategory === "dresses") return coatHeight ? clamp(coatHeight * 0.94, coatHeight * 0.85, coatHeight * 1.1) : 62;
  if (metadata.bodyCoverage === "full_body") return 61;
  if (metadata.bodyCoverage === "upper_body") return 44;
  if (metadata.bodyCoverage === "lower_body") return 54;
  if (metadata.bodyCoverage === "feet") return 24;
  return 26;
};

const getShoulderWidthRatio = (metadata: LayoutMetadata) => {
  const explicitWidth = Number(metadata.upperBodyWidthAnchor);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0 && explicitWidth <= 1) return clamp(explicitWidth, 0.08, 1);
  const left = metadata.bodyAnchors?.leftShoulder;
  const right = metadata.bodyAnchors?.rightShoulder;
  if (!left || !right) return null;
  const shoulderWidth = Math.abs(Number(right.x) - Number(left.x));
  return Number.isFinite(shoulderWidth) && shoulderWidth > 0.08 ? clamp(shoulderWidth, 0.08, 1) : null;
};

const toRelativePoint = (point: { x: number; y: number } | undefined, analysis?: ImageAnalysis | null) => {
  if (!point) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x > 1 && analysis?.imageWidth ? x / analysis.imageWidth : x, 0, 1),
    y: clamp(y > 1 && analysis?.imageHeight ? y / analysis.imageHeight : y, 0, 1),
  };
};

const getPrioritizedUpperFit = (metadata: LayoutMetadata) => {
  const validated = metadata.validatedMeasurementAnchors?.upperFit;
  const measurement = metadata.measurementAnchors?.upperFit;
  const layout = metadata.layoutAnchors?.upperFit;
  const human = [validated, measurement].find((group) => group?.source === "human");
  const ai = [validated, measurement].find((group) => group?.source === "ai");
  if (human) return { group: human, source: "human", isMeasurement: true };
  if (ai) return { group: ai, source: "ai", isMeasurement: true };
  if (layout?.source === "alpha_profile") return { group: layout, source: "alpha_profile", isMeasurement: false };
  if (layout?.source === "ratio_guard") return { group: layout, source: "ratio_guard", isMeasurement: false };
  if (layout) return { group: layout, source: layout.source || "fallback", isMeasurement: false };
  return null;
};

const widthToRatio = (width: number, analysis?: ImageAnalysis | null) => {
  if (!Number.isFinite(width) || width <= 0) return null;
  const ratio = width > 1 && analysis?.imageWidth ? width / analysis.imageWidth : width;
  return ratio > 0.08 ? clamp(ratio, 0.08, 1) : null;
};

const getUpperAnchorPair = (metadata: LayoutMetadata, analysis?: ImageAnalysis | null) => {
  const prioritizedFit = getPrioritizedUpperFit(metadata)?.group;
  const left = toRelativePoint(prioritizedFit?.leftUpperFitAnchor || metadata.leftUpperAnchor, analysis) || toRelativePoint(metadata.bodyAnchors?.leftShoulder, analysis);
  const right = toRelativePoint(prioritizedFit?.rightUpperFitAnchor || metadata.rightUpperAnchor, analysis) || toRelativePoint(metadata.bodyAnchors?.rightShoulder, analysis);
  if (!left || !right) return null;
  const width = Math.abs(right.x - left.x);
  return width > 0.08 ? { left, right, width: clamp(width, 0.08, 1) } : null;
};

const hasSufficientAnchorConfidence = (metadata: LayoutMetadata) => Number(metadata.confidence) >= 0.5;

const getRealMeasurementPair = (metadata: LayoutMetadata, analysis: ImageAnalysis | null | undefined, visualCategory: VisualCategory) => {
  const isUpperBodyGarment = ["outerwear", "dresses", "tops"].includes(visualCategory);
  if (isUpperBodyGarment) {
    const upperFit = getPrioritizedUpperFit(metadata)?.isMeasurement ? getPrioritizedUpperFit(metadata)!.group : null;
    if (!upperFit || !["ai", "human"].includes(String(upperFit.source)) || Number(upperFit.confidence) < 0.5) return null;
    const left = toRelativePoint(upperFit.leftUpperFitAnchor, analysis);
    const right = toRelativePoint(upperFit.rightUpperFitAnchor, analysis);
    if (!left || !right) return null;
    const width = Math.abs(right.x - left.x);
    return width > 0.08
      ? { left, right, width: clamp(width, 0.08, 1), leftLabel: "L upper", rightLabel: "R upper", fullLabel: "leftUpperFitAnchor → rightUpperFitAnchor" }
      : null;
  }

  if (visualCategory === "bottoms") {
    const waist = metadata.validatedMeasurementAnchors?.waist || metadata.measurementAnchors?.waist;
    if (!waist || !["ai", "human"].includes(String(waist.source)) || Number(waist.confidence) < 0.5) return null;
    const left = toRelativePoint(waist.leftWaistAnchor, analysis);
    const right = toRelativePoint(waist.rightWaistAnchor, analysis);
    if (!left || !right) return null;
    const width = Math.abs(right.x - left.x);
    return width > 0.08
      ? { left, right, width: clamp(width, 0.08, 1), leftLabel: "L waist", rightLabel: "R waist", fullLabel: "leftWaistAnchor → rightWaistAnchor" }
      : null;
  }

  return null;
};

const getUpperBodyWidthRatio = (metadata: LayoutMetadata, analysis?: ImageAnalysis | null) => {
  const prioritizedFit = getPrioritizedUpperFit(metadata)?.group;
  const prioritizedWidth = Number(prioritizedFit?.upperBodyFitWidth);
  const prioritizedRatio = widthToRatio(prioritizedWidth, analysis);
  if (prioritizedRatio) return prioritizedRatio;
  const explicitWidth = Number(metadata.upperBodyWidthAnchor);
  const explicitRatio = widthToRatio(explicitWidth, analysis);
  if (explicitRatio) return explicitRatio;
  return getUpperAnchorPair(metadata, analysis)?.width || getShoulderWidthRatio(metadata);
};

const formatWidthAnchor = (metadata: LayoutMetadata, analysis?: ImageAnalysis | null) => {
  const explicitWidth = Number(getPrioritizedUpperFit(metadata)?.group?.upperBodyFitWidth || metadata.upperBodyWidthAnchor);
  const ratio = getUpperBodyWidthRatio(metadata, analysis);
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) {
    return explicitWidth > 1 ? `${explicitWidth.toFixed(0)}px / ${(ratio ?? 0).toFixed(2)}` : explicitWidth.toFixed(2);
  }
  return ratio ? ratio.toFixed(2) : "—";
};

const getShoulderCenter = (metadata: LayoutMetadata) => {
  const left = metadata.bodyAnchors?.leftShoulder;
  const right = metadata.bodyAnchors?.rightShoulder;
  if (!left || !right) return null;
  return { x: (Number(left.x) + Number(right.x)) / 2, y: (Number(left.y) + Number(right.y)) / 2 };
};

const getNormalizedStyle = ({
  analysis,
  duplicateIndex,
  intendedVisibleHeight,
  layout,
  metadata,
  stackIndex,
  targetRenderedShoulderWidth,
}: {
  analysis?: ImageAnalysis | null;
  duplicateIndex: number;
  intendedVisibleHeight: number;
  layout: (typeof stackLayouts)[number];
  metadata: LayoutMetadata;
  stackIndex: number;
  targetRenderedShoulderWidth?: number;
}): NormalizedRenderStyle => {
  const offset = centeredOffsets[duplicateIndex % centeredOffsets.length];
  const overflowOffset = Math.max(0, stackIndex - stackLayouts.length + 1) * 10;
  const visibleHeightRatio = clamp(Number(analysis?.visibleHeightRatio) || 1, 0.18, 1);
  const visibleWidthRatio = clamp(Number(analysis?.visibleWidthRatio) || 1, 0.18, 1);
  const imageRatio = analysis?.imageWidth && analysis?.imageHeight ? analysis.imageWidth / analysis.imageHeight : 1;
  const visibleAspect = analysis?.visibleWidth && analysis?.visibleHeight ? analysis.visibleWidth / analysis.visibleHeight : imageRatio;
  const preferredScale = clamp(Number(metadata.preferredPreviewScale) || 0.55, 0.2, 1);
  const intendedVisibleWidth = clamp(intendedVisibleHeight * visibleAspect * (0.82 + preferredScale * 0.24), 22, 66);
  const boxHeight = clamp(intendedVisibleHeight / visibleHeightRatio, 22, 88);
  const upperBodyWidthRatio = getUpperBodyWidthRatio(metadata, analysis);
  const fitSource = getPrioritizedUpperFit(metadata)?.source || (upperBodyWidthRatio ? "legacy" : "fallback");
  const upperAnchorBoxWidth = upperBodyWidthRatio && targetRenderedShoulderWidth
    ? targetRenderedShoulderWidth / upperBodyWidthRatio
    : null;
  const widthClampMax = upperAnchorBoxWidth ? (fitSource === "human" ? 136 : 122) : 92;
  const boxWidth = clamp(Math.max(intendedVisibleWidth / visibleWidthRatio, upperAnchorBoxWidth || 0), 22, widthClampMax);
  const visibleCenterX = analysis?.imageWidth && analysis?.visibleWidth
    ? ((analysis.visibleX ?? 0) + analysis.visibleWidth / 2) / analysis.imageWidth
    : 0.5;
  const visibleCenterY = analysis?.imageHeight && analysis?.visibleHeight
    ? ((analysis.visibleY ?? 0) + analysis.visibleHeight / 2) / analysis.imageHeight
    : 0.5;

  const anchorShiftXPct = (0.5 - visibleCenterX) * 100;
  const anchorShiftYPct = (0.5 - visibleCenterY) * 100;

  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${boxWidth}%`,
    height: `${boxHeight}%`,
    zIndex: layout.zIndex,
    transform: `translate(${offset.x + overflowOffset}px, ${offset.y + overflowOffset}px) translate(${anchorShiftXPct}%, ${anchorShiftYPct}%) rotate(${layout.rotate}deg)`,
    boxWidthPct: boxWidth,
    boxHeightPct: boxHeight,
    anchorShiftXPct,
    anchorShiftYPct,
    rotationDeg: layout.rotate,
    fitSource,
    upperFitWidthRatio: upperBodyWidthRatio,
    targetRenderedFitWidth: targetRenderedShoulderWidth ?? null,
    calculatedImageBoxWidth: upperAnchorBoxWidth,
    finalRenderedFitWidth: upperBodyWidthRatio ? upperBodyWidthRatio * boxWidth : null,
  };
};

export const OutfitCollage = ({ garments, debugAnchors = false }: OutfitCollageProps) => {
  if (!garments || garments.length === 0) return null;

  const classified = garments
    .map((garment) => ({ garment, visualCategory: classifyGarment(garment), imageUrl: getImageUrl(garment) }))
    .filter((item) => item.imageUrl)
    .sort((a, b) => visualOrder[a.visualCategory] - visualOrder[b.visualCategory]);

  const hasOuterwear = classified.some((item) => item.visualCategory === "outerwear");
  const hasDress = classified.some((item) => item.visualCategory === "dresses");
  const coatHeight = hasOuterwear ? 64 : undefined;
  const showDebugAnchors = debugAnchors || new URLSearchParams(window.location.search).get("outfitDebugAnchors") === "1";

  const seenCounts: Partial<Record<VisualCategory, number>> = {};
  let renderItems = classified.map(({ garment, visualCategory, imageUrl }, stackIndex) => {
    const duplicateIndex = seenCounts[visualCategory] ?? 0;
    seenCounts[visualCategory] = duplicateIndex + 1;
    const inferred = inferMetadata(garment, visualCategory);
    const metadata = {
      ...inferred,
      bodyAnchors: inferred.bodyAnchors || estimateBodyAnchors(garment?.image_analysis, visualCategory),
    };
    const intendedVisibleHeight = getTargetVisibleHeight(visualCategory, metadata, coatHeight);
    const targetRenderedShoulderWidth = visualCategory === "outerwear"
      ? 44
      : visualCategory === "dresses"
        ? (hasOuterwear ? 41 : 38)
        : visualCategory === "tops"
          ? (hasOuterwear ? 36 : 34)
          : undefined;
    const layout = stackLayouts[Math.min(stackIndex, stackLayouts.length - 1)];
    const style = getNormalizedStyle({
      analysis: garment?.image_analysis,
      duplicateIndex,
      intendedVisibleHeight,
      layout,
      metadata,
      stackIndex,
      targetRenderedShoulderWidth,
    });
    const upperWidthRatio = getUpperBodyWidthRatio(metadata, garment?.image_analysis);
    return {
      garment,
      visualCategory,
      imageUrl,
      duplicateIndex,
      metadata,
      style,
      upperFitWidthRatio: upperWidthRatio,
      renderedUpperWidth: upperWidthRatio ? upperWidthRatio * style.boxWidthPct : null,
    };
  });

  let coatRenderedWidth = renderItems.find((item) => item.visualCategory === "outerwear")?.renderedUpperWidth ?? null;
  let dressRenderedWidth = renderItems.find((item) => item.visualCategory === "dresses")?.renderedUpperWidth ?? null;
  let dressToCoatRatio = coatRenderedWidth && dressRenderedWidth ? dressRenderedWidth / coatRenderedWidth : null;

  if (hasOuterwear && hasDress && coatRenderedWidth && dressToCoatRatio !== null && (dressToCoatRatio < 0.85 || dressToCoatRatio > 0.95)) {
    const targetDressRenderedFitWidth = coatRenderedWidth * 0.9;
    renderItems = renderItems.map((item) => {
      if (item.visualCategory !== "dresses" || !item.upperFitWidthRatio) return item;
      const calculatedImageBoxWidth = targetDressRenderedFitWidth / item.upperFitWidthRatio;
      const nextWidth = clamp(calculatedImageBoxWidth, 22, item.style.fitSource === "human" ? 138 : 124);
      const scale = nextWidth / Math.max(item.style.boxWidthPct, 1);
      const nextHeight = clamp(item.style.boxHeightPct * clamp(scale, 0.86, 1.28), 22, 104);
      const finalRenderedFitWidth = item.upperFitWidthRatio * nextWidth;
      const nextStyle = {
        ...item.style,
        width: `${nextWidth}%`,
        height: `${nextHeight}%`,
        boxWidthPct: nextWidth,
        boxHeightPct: nextHeight,
        targetRenderedFitWidth: targetDressRenderedFitWidth,
        calculatedImageBoxWidth,
        finalRenderedFitWidth,
      };
      return { ...item, style: nextStyle, renderedUpperWidth: finalRenderedFitWidth };
    });
    coatRenderedWidth = renderItems.find((item) => item.visualCategory === "outerwear")?.renderedUpperWidth ?? null;
    dressRenderedWidth = renderItems.find((item) => item.visualCategory === "dresses")?.renderedUpperWidth ?? null;
    dressToCoatRatio = coatRenderedWidth && dressRenderedWidth ? dressRenderedWidth / coatRenderedWidth : null;
  }

  return (
    <div className="relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden">
      {renderItems.map(({ garment, visualCategory, imageUrl, duplicateIndex, metadata, style, renderedUpperWidth }) => {
        const baseAlt = garment?.name || garment?.category || "Garment";
        const { boxWidthPct, boxHeightPct, anchorShiftXPct, anchorShiftYPct, rotationDeg, fitSource: styleFitSource, upperFitWidthRatio, targetRenderedFitWidth, calculatedImageBoxWidth, finalRenderedFitWidth, ...imageStyle } = style;
        const upperPair = getUpperAnchorPair(metadata, garment?.image_analysis);
        const measurementPair = getRealMeasurementPair(metadata, garment?.image_analysis, visualCategory);
        const layoutGroup = metadata.layoutAnchors?.upperFit || metadata.layoutAnchors?.waist || metadata.layoutAnchors?.length;
        const layoutSource = layoutGroup?.source;
        const prioritizedUpperFit = getPrioritizedUpperFit(metadata);
        const fitSource = prioritizedUpperFit?.source || (measurementPair ? ((metadata.validatedMeasurementAnchors?.waist || metadata.measurementAnchors?.waist) as any)?.source : layoutSource) || styleFitSource || "fallback";
        const finalFitWidth = finalRenderedFitWidth ?? renderedUpperWidth ?? (upperFitWidthRatio ? upperFitWidthRatio * boxWidthPct : null);
        const renderedRatios = {
          source: fitSource,
          calibratedUpperFitWidth: prioritizedUpperFit?.group?.upperBodyFitWidth ?? null,
          upperFitWidthRatio: upperFitWidthRatio ?? null,
          targetRenderedFitWidth: targetRenderedFitWidth ?? null,
          calculatedImageBoxWidth: calculatedImageBoxWidth ?? null,
          finalRenderedFitWidth: finalFitWidth,
          dressToCoat: visualCategory === "dresses" ? dressToCoatRatio : null,
          finalDressToCoatFitRatio: visualCategory === "dresses" ? dressToCoatRatio : null,
        };
        const measurementCenter = measurementPair ? { x: (measurementPair.left.x + measurementPair.right.x) / 2, y: (measurementPair.left.y + measurementPair.right.y) / 2 } : null;
        const landmarkPoints = [
          measurementPair?.left,
          measurementPair?.right,
          toRelativePoint(metadata.necklineCenter || metadata.bodyAnchors?.necklineCenter, garment?.image_analysis),
          toRelativePoint(metadata.waistCenter || metadata.bodyAnchors?.waistCenter, garment?.image_analysis),
          toRelativePoint(metadata.hemCenter || metadata.bodyAnchors?.hemCenter, garment?.image_analysis),
        ].filter(Boolean);

        return (
          <div key={`${garment?.id ?? imageUrl}-${duplicateIndex}`}>
            <img
              src={imageUrl}
              alt={baseAlt}
              loading="lazy"
              decoding="async"
              className={cn("absolute object-contain object-center drop-shadow-md")}
              style={imageStyle}
            />
            {showDebugAnchors && measurementPair && measurementCenter && (
              <div className="absolute pointer-events-none" style={imageStyle} aria-hidden="true">
                <div
                  className="absolute z-[92] h-0.5 bg-primary"
                  style={{
                    left: `${measurementPair.left.x * 100}%`,
                    top: `${measurementCenter.y * 100}%`,
                    width: `${measurementPair.width * 100}%`,
                  }}
                />
                <span
                  className="absolute z-[93] -translate-x-full -translate-y-[140%] rounded bg-background/90 px-1 py-0.5 text-[8px] font-medium leading-none text-foreground shadow-sm"
                  style={{ left: `${measurementPair.left.x * 100}%`, top: `${measurementPair.left.y * 100}%` }}
                >
                  {measurementPair.leftLabel}
                </span>
                <span
                  className="absolute z-[93] translate-x-1 -translate-y-[140%] rounded bg-background/90 px-1 py-0.5 text-[8px] font-medium leading-none text-foreground shadow-sm"
                  style={{ left: `${measurementPair.right.x * 100}%`, top: `${measurementPair.right.y * 100}%` }}
                >
                  {measurementPair.rightLabel}
                </span>
                <span className="absolute bottom-1 left-1 z-[91] max-w-[92%] rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-foreground shadow-sm">
                  <span className="block">{metadata.garmentType || visualCategory}</span>
                  <span className="block">{measurementPair.fullLabel}</span>
                  <span className="block">measured fit: {formatWidthAnchor(metadata, garment?.image_analysis)}</span>
                  <span className="block">source: {fitSource}</span>
                  <span className="block">confidence: {((metadata.validatedMeasurementAnchors?.upperFit || metadata.validatedMeasurementAnchors?.waist || metadata.measurementAnchors?.upperFit || metadata.measurementAnchors?.waist) as any)?.confidence?.toFixed?.(2) ?? "—"}</span>
                  <span className="block">upperFitWidthRatio: {upperFitWidthRatio?.toFixed?.(3) ?? "—"}</span>
                  <span className="block">targetRenderedFitWidth: {targetRenderedFitWidth?.toFixed?.(1) ?? "—"}%</span>
                  <span className="block">calculatedImageBoxWidth: {calculatedImageBoxWidth?.toFixed?.(1) ?? "—"}%</span>
                  <span className="block">finalRenderedFitWidth: {(finalFitWidth ?? measurementPair.width * boxWidthPct).toFixed(1)}%</span>
                </span>
                {landmarkPoints.map((point, pointIndex) => (
                  <span
                    key={pointIndex}
                    className="absolute z-[96] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
                    style={{ left: `${point!.x * 100}%`, top: `${point!.y * 100}%` }}
                  />
                ))}
              </div>
            )}
            {showDebugAnchors && !measurementPair && layoutSource && (
              <div className="absolute bottom-1 left-1 z-[91] max-w-[92%] rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-medium leading-3 text-foreground shadow-sm" style={imageStyle}>
                <span className="block">{metadata.garmentType || visualCategory}</span>
                <span className="block">estimated layout scaling</span>
                <span className="block">source: {layoutSource}</span>
                <span className="block">confidence: {layoutGroup?.confidence?.toFixed?.(2) ?? "—"}</span>
                <span className="block">width: {formatWidthAnchor(metadata, garment?.image_analysis)}</span>
                <span className="block">upperFitWidthRatio: {upperFitWidthRatio?.toFixed?.(3) ?? "—"}</span>
                <span className="block">calculatedImageBoxWidth: {calculatedImageBoxWidth?.toFixed?.(1) ?? "—"}%</span>
                <span className="block">finalRenderedFitWidth: {finalFitWidth?.toFixed?.(1) ?? "—"}%</span>
              </div>
            )}
            {showDebugAnchors && (
              <details className="absolute right-1 top-1 z-[91] max-w-[58%] rounded bg-background/90 px-1.5 py-0.5 text-[8px] leading-3 text-foreground shadow-sm" style={imageStyle}>
                <summary className="cursor-pointer font-medium">QA</summary>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ rawAiLandmarks: metadata.rawAiLandmarks, validatedMeasurementAnchors: metadata.validatedMeasurementAnchors || metadata.measurementAnchors, layoutAnchors: metadata.layoutAnchors, fitSource, renderedRatios }, null, 2)}</pre>
              </details>
            )}
          </div>
        );
      })}
      {showDebugAnchors && hasOuterwear && hasDress && (
        <div className="absolute bottom-2 left-2 right-2 z-[90] rounded bg-background/90 px-2 py-1 text-[10px] font-medium leading-4 text-foreground shadow-sm">
          <div>coat width: {coatRenderedWidth?.toFixed(1) ?? "—"}%</div>
          <div>dress width: {dressRenderedWidth?.toFixed(1) ?? "—"}%</div>
          <div>final dress/coat fit ratio: {dressToCoatRatio ? dressToCoatRatio.toFixed(2) : "—"}</div>
        </div>
      )}
    </div>
  );
};

export default OutfitCollage;