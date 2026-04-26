import { useState, type CSSProperties } from "react";
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
  offsetXPct: number;
  offsetYPct: number;
  anchorShiftXPct: number;
  anchorShiftYPct: number;
  rotationDeg: number;
  imageRatio: number;
  fitSource?: string;
  upperFitWidthRatio?: number | null;
  targetRenderedFitWidth?: number | null;
  calculatedImageBoxWidth?: number | null;
  finalRenderedFitWidth?: number | null;
  sizingDebug?: {
    upperFitSource?: string;
    upperFitWidthRatio?: number | null;
    targetDressToCoatRatio?: number | null;
    minimumDressToCoatRatio?: number | null;
    requiredDressBoxWidth?: number | null;
    requiredDressBoxHeight?: number | null;
    requiredDressBoxScale?: number | null;
    minimumRequiredDressBoxWidth?: number | null;
    boxWidthBeforeClamp?: number | null;
    boxHeightBeforeClamp?: number | null;
    boxWidthAfterClamp?: number | null;
    boxHeightAfterClamp?: number | null;
    finalRenderedFitWidth?: number | null;
    renderedFitLineLength?: number | null;
  };
};

type RenderItem = {
  garment: any;
  visualCategory: VisualCategory;
  imageUrl: string;
  duplicateIndex: number;
  metadata: LayoutMetadata;
  style: NormalizedRenderStyle;
  upperFitWidthRatio: number | null | undefined;
  renderedUpperWidth: number | null;
};

type GroupNormalization = {
  canvasCenter: { x: number; y: number };
  boundingBox: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null;
  groupCenter: { x: number; y: number } | null;
  translateX: number;
  translateY: number;
  scale: number;
};

type ItemBounds = { left: number; top: number; right: number; bottom: number; width: number; height: number; center: { x: number; y: number } };

type CompositionMetrics = {
  selectedLayoutTemplate: string;
  garmentCenters: Record<string, { x: number; y: number }>;
  garmentBounds: Record<string, ItemBounds>;
  pairMetrics: Array<{
    a: string;
    b: string;
    horizontalOverlapPct: number;
    verticalOverlapPct: number;
    centerDistance: number;
  }>;
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

const canvasAspectRatio = 3 / 4;

const getObjectContainRect = (boxWidthPct: number, boxHeightPct: number, imageRatio: number) => {
  const boxPixelAspect = (boxWidthPct / Math.max(boxHeightPct, 1)) * canvasAspectRatio;
  if (!Number.isFinite(imageRatio) || imageRatio <= 0 || !Number.isFinite(boxPixelAspect) || boxPixelAspect <= 0) {
    return { left: 0, top: 0, width: 100, height: 100 };
  }
  if (boxPixelAspect > imageRatio) {
    const width = clamp((imageRatio / boxPixelAspect) * 100, 0, 100);
    return { left: (100 - width) / 2, top: 0, width, height: 100 };
  }
  const height = clamp((boxPixelAspect / imageRatio) * 100, 0, 100);
  return { left: 0, top: (100 - height) / 2, width: 100, height };
};

const mapImagePointToBox = (point: { x: number; y: number }, style: NormalizedRenderStyle) => {
  const imageRect = getObjectContainRect(style.boxWidthPct, style.boxHeightPct, style.imageRatio);
  return {
    x: imageRect.left + point.x * imageRect.width,
    y: imageRect.top + point.y * imageRect.height,
    imageRect,
    coordinateSpace: "source_image_normalized_to_object_contain_box",
  };
};

const rotatePoint = (point: { x: number; y: number }, center: { x: number; y: number }, rotationDeg: number) => {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
};

const rotateCanvasPoint = (point: { x: number; y: number }, center: { x: number; y: number }, rotationDeg: number) => {
  const rotated = rotatePoint(
    { x: point.x, y: point.y / canvasAspectRatio },
    { x: center.x, y: center.y / canvasAspectRatio },
    rotationDeg
  );
  return { x: rotated.x, y: rotated.y * canvasAspectRatio };
};

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
  const widthClampMax = upperAnchorBoxWidth ? (fitSource === "human" ? 166 : 122) : 92;
  const boxWidth = clamp(Math.max(intendedVisibleWidth / visibleWidthRatio, upperAnchorBoxWidth || 0), 22, widthClampMax);
  const visibleCenterX = analysis?.imageWidth && analysis?.visibleWidth
    ? ((analysis.visibleX ?? 0) + analysis.visibleWidth / 2) / analysis.imageWidth
    : 0.5;
  const visibleCenterY = analysis?.imageHeight && analysis?.visibleHeight
    ? ((analysis.visibleY ?? 0) + analysis.visibleHeight / 2) / analysis.imageHeight
    : 0.5;

  const anchorShiftXPct = (0.5 - visibleCenterX) * 100;
  const anchorShiftYPct = (0.5 - visibleCenterY) * 100;

  const offsetXPct = anchorShiftXPct + ((offset.x + overflowOffset) / Math.max(boxWidth, 1)) * 100;
  const offsetYPct = anchorShiftYPct + ((offset.y + overflowOffset) / Math.max(boxHeight, 1)) * 100;

  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${boxWidth}%`,
    height: `${boxHeight}%`,
    zIndex: layout.zIndex,
    transform: `translate(${offsetXPct}%, ${offsetYPct}%) rotate(${layout.rotate}deg)`,
    boxWidthPct: boxWidth,
    boxHeightPct: boxHeight,
    offsetXPct,
    offsetYPct,
    anchorShiftXPct,
    anchorShiftYPct,
    rotationDeg: layout.rotate,
    imageRatio,
    fitSource,
    upperFitWidthRatio: upperBodyWidthRatio,
    targetRenderedFitWidth: targetRenderedShoulderWidth ?? null,
    calculatedImageBoxWidth: upperAnchorBoxWidth,
    finalRenderedFitWidth: upperBodyWidthRatio ? upperBodyWidthRatio * boxWidth : null,
    sizingDebug: {
      upperFitSource: fitSource,
      upperFitWidthRatio: upperBodyWidthRatio,
      boxWidthBeforeClamp: Math.max(intendedVisibleWidth / visibleWidthRatio, upperAnchorBoxWidth || 0),
      boxWidthAfterClamp: boxWidth,
      finalRenderedFitWidth: upperBodyWidthRatio ? upperBodyWidthRatio * boxWidth : null,
    },
  };
};

const getItemVisualBounds = (style: NormalizedRenderStyle): ItemBounds => {
  const left = Number.parseFloat(String(style.left ?? 0));
  const top = Number.parseFloat(String(style.top ?? 0));
  const translatedLeft = left + (style.offsetXPct / 100) * style.boxWidthPct;
  const translatedTop = top + (style.offsetYPct / 100) * style.boxHeightPct;
  const imageRect = getObjectContainRect(style.boxWidthPct, style.boxHeightPct, style.imageRatio);
  const imageLeft = translatedLeft + (imageRect.left / 100) * style.boxWidthPct;
  const imageTop = translatedTop + (imageRect.top / 100) * style.boxHeightPct;
  const imageWidth = (imageRect.width / 100) * style.boxWidthPct;
  const imageHeight = (imageRect.height / 100) * style.boxHeightPct;
  const center = { x: translatedLeft + style.boxWidthPct / 2, y: translatedTop + style.boxHeightPct / 2 };
  const corners = [
    { x: imageLeft, y: imageTop },
    { x: imageLeft + imageWidth, y: imageTop },
    { x: imageLeft + imageWidth, y: imageTop + imageHeight },
    { x: imageLeft, y: imageTop + imageHeight },
  ].map((point) => rotateCanvasPoint(point, center, style.rotationDeg));
  const box = corners.reduce(
    (acc, point) => ({ left: Math.min(acc.left, point.x), top: Math.min(acc.top, point.y), right: Math.max(acc.right, point.x), bottom: Math.max(acc.bottom, point.y) }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
  return { ...box, width: box.right - box.left, height: box.bottom - box.top, center: { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } };
};

const normalizeOutfitGroup = (items: Array<{ style: NormalizedRenderStyle }>): GroupNormalization => {
  const canvasCenter = { x: 50, y: 50 };
  if (!items.length) return { canvasCenter, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1 };

  const boxes = items.map(({ style }) => getItemVisualBounds(style));

  const rawBox = boxes.reduce(
    (acc, box) => ({
      left: Math.min(acc.left, box.left),
      top: Math.min(acc.top, box.top),
      right: Math.max(acc.right, box.right),
      bottom: Math.max(acc.bottom, box.bottom),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
  const boundingBox = { ...rawBox, width: rawBox.right - rawBox.left, height: rawBox.bottom - rawBox.top };
  const groupCenter = { x: boundingBox.left + boundingBox.width / 2, y: boundingBox.top + boundingBox.height / 2 };
  const targetOccupancy = items.length <= 2 ? 0.82 : items.length <= 4 ? 0.84 : 0.86;
  const safeCanvas = 100 - 20;
  const targetWidth = safeCanvas * targetOccupancy;
  const targetHeight = safeCanvas * targetOccupancy;
  const scale = clamp(Math.min(targetWidth / Math.max(boundingBox.width, 1), targetHeight / Math.max(boundingBox.height, 1), 1), 0.04, 1);
  return {
    canvasCenter,
    boundingBox,
    groupCenter,
    translateX: canvasCenter.x - groupCenter.x * scale,
    translateY: canvasCenter.y - groupCenter.y * scale,
    scale,
  };
};

const mapMeasurementPointToCanvas = (point: { x: number; y: number }, style: NormalizedRenderStyle, groupNormalization: GroupNormalization) => {
  const mapped = mapImagePointToBox(point, style);
  const left = Number.parseFloat(String(style.left ?? 0));
  const top = Number.parseFloat(String(style.top ?? 0));
  const translatedLeft = left + (style.offsetXPct / 100) * style.boxWidthPct;
  const translatedTop = top + (style.offsetYPct / 100) * style.boxHeightPct;
  const localPoint = {
    x: translatedLeft + (mapped.x / 100) * style.boxWidthPct,
    y: translatedTop + (mapped.y / 100) * style.boxHeightPct,
  };
  const center = { x: translatedLeft + style.boxWidthPct / 2, y: translatedTop + style.boxHeightPct / 2 };
  const rotated = rotateCanvasPoint(localPoint, center, style.rotationDeg);
  return {
    x: groupNormalization.translateX + rotated.x * groupNormalization.scale,
    y: groupNormalization.translateY + rotated.y * groupNormalization.scale,
    objectContainRect: mapped.imageRect,
  };
};

const getCanvasDistance = (left: { x: number; y: number }, right: { x: number; y: number }) => {
  const dx = right.x - left.x;
  const dy = (right.y - left.y) / canvasAspectRatio;
  return Math.sqrt(dx * dx + dy * dy);
};

const getRenderedMeasurement = (item: RenderItem | undefined, groupNormalization: GroupNormalization) => {
  if (!item) return null;
  const measurementPair = getRealMeasurementPair(item.metadata, item.garment?.image_analysis, item.visualCategory);
  if (!measurementPair) return null;
  const leftCanvas = mapMeasurementPointToCanvas(measurementPair.left, item.style, groupNormalization);
  const rightCanvas = mapMeasurementPointToCanvas(measurementPair.right, item.style, groupNormalization);
  const renderedFitLineLength = getCanvasDistance(leftCanvas, rightCanvas);
  return {
    localFitRatio: measurementPair.width,
    sourceLeftAnchor: measurementPair.left,
    sourceRightAnchor: measurementPair.right,
    finalLeftAnchorCanvasPoint: { x: leftCanvas.x, y: leftCanvas.y },
    finalRightAnchorCanvasPoint: { x: rightCanvas.x, y: rightCanvas.y },
    objectContainRect: leftCanvas.objectContainRect,
    renderedFitLineLength,
  };
};

const getRenderedSizingMetrics = (items: RenderItem[], groupNormalization: GroupNormalization) => {
  const coatItem = items.find((item) => item.visualCategory === "outerwear");
  const dressItem = items.find((item) => item.visualCategory === "dresses");
  const coat = getRenderedMeasurement(coatItem, groupNormalization);
  const dress = getRenderedMeasurement(dressItem, groupNormalization);
  return {
    coat,
    dress,
    ratio: coat?.renderedFitLineLength && dress?.renderedFitLineLength ? dress.renderedFitLineLength / coat.renderedFitLineLength : null,
  };
};

const getTransformedGroupBounds = (boundingBox: GroupNormalization["boundingBox"], groupNormalization: GroupNormalization) => {
  if (!boundingBox) return null;
  const left = groupNormalization.translateX + boundingBox.left * groupNormalization.scale;
  const top = groupNormalization.translateY + boundingBox.top * groupNormalization.scale;
  const right = groupNormalization.translateX + boundingBox.right * groupNormalization.scale;
  const bottom = groupNormalization.translateY + boundingBox.bottom * groupNormalization.scale;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

export const OutfitCollage = ({ garments, debugAnchors = false }: OutfitCollageProps) => {
  if (!garments || garments.length === 0) return null;
  const [compositionQaOpen, setCompositionQaOpen] = useState(false);

  const classified = garments
    .map((garment) => ({ garment, visualCategory: classifyGarment(garment), imageUrl: getImageUrl(garment) }))
    .filter((item) => item.imageUrl)
    .sort((a, b) => visualOrder[a.visualCategory] - visualOrder[b.visualCategory]);

  const hasOuterwear = classified.some((item) => item.visualCategory === "outerwear");
  const hasDress = classified.some((item) => item.visualCategory === "dresses");
  const coatHeight = hasOuterwear ? 64 : undefined;
  const showDebugAnchors = debugAnchors || new URLSearchParams(window.location.search).get("outfitDebugAnchors") === "1";

  const seenCounts: Partial<Record<VisualCategory, number>> = {};
  let renderItems: RenderItem[] = classified.map(({ garment, visualCategory, imageUrl }, stackIndex) => {
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

  const targetDressToCoatRatio = 0.9;
  const minimumDressToCoatRatio = 0.75;
  let groupNormalization = normalizeOutfitGroup(renderItems);
  let renderedSizingMetrics = getRenderedSizingMetrics(renderItems, groupNormalization);

  if (hasOuterwear && hasDress && renderedSizingMetrics.coat?.renderedFitLineLength && renderedSizingMetrics.dress?.renderedFitLineLength && renderedSizingMetrics.ratio !== null && renderedSizingMetrics.ratio < targetDressToCoatRatio) {
    const targetDressRenderedFitLine = renderedSizingMetrics.coat.renderedFitLineLength * targetDressToCoatRatio;
    const minimumDressRenderedFitLine = renderedSizingMetrics.coat.renderedFitLineLength * minimumDressToCoatRatio;
    const requiredDressBoxScale = targetDressRenderedFitLine / Math.max(renderedSizingMetrics.dress.renderedFitLineLength, 0.001);
    const minimumRequiredDressBoxScale = minimumDressRenderedFitLine / Math.max(renderedSizingMetrics.dress.renderedFitLineLength, 0.001);
    renderItems = renderItems.map((item) => {
      if (item.visualCategory !== "dresses" || !item.upperFitWidthRatio) return item;
      const requiredDressBoxWidth = item.style.boxWidthPct * requiredDressBoxScale;
      const requiredDressBoxHeight = item.style.boxHeightPct * requiredDressBoxScale;
      const minimumRequiredDressBoxWidth = item.style.boxWidthPct * minimumRequiredDressBoxScale;
      const boxWidthBeforeClamp = Math.max(item.style.boxWidthPct, requiredDressBoxWidth);
      const boxHeightBeforeClamp = Math.max(item.style.boxHeightPct, requiredDressBoxHeight);
      const maxDressBoxWidth = Math.max(1000, requiredDressBoxWidth, minimumRequiredDressBoxWidth);
      const nextWidth = clamp(boxWidthBeforeClamp, minimumRequiredDressBoxWidth, maxDressBoxWidth);
      const nextHeight = clamp(boxHeightBeforeClamp, item.style.boxHeightPct * minimumRequiredDressBoxScale, 1000);
      const finalRenderedFitWidth = item.upperFitWidthRatio * nextWidth;
      const nextStyle = {
        ...item.style,
        width: `${nextWidth}%`,
        height: `${nextHeight}%`,
        boxWidthPct: nextWidth,
        boxHeightPct: nextHeight,
        targetRenderedFitWidth: targetDressRenderedFitLine,
        calculatedImageBoxWidth: requiredDressBoxWidth,
        finalRenderedFitWidth,
        sizingDebug: {
          ...item.style.sizingDebug,
          upperFitSource: item.style.fitSource,
          upperFitWidthRatio: item.upperFitWidthRatio,
          targetDressToCoatRatio,
          minimumDressToCoatRatio,
          requiredDressBoxWidth,
          requiredDressBoxHeight,
          requiredDressBoxScale,
          minimumRequiredDressBoxWidth,
          boxWidthBeforeClamp,
          boxHeightBeforeClamp,
          boxWidthAfterClamp: nextWidth,
          boxHeightAfterClamp: nextHeight,
          finalRenderedFitWidth,
        },
      };
      return { ...item, style: nextStyle, renderedUpperWidth: finalRenderedFitWidth };
    });
    groupNormalization = normalizeOutfitGroup(renderItems);
    renderedSizingMetrics = getRenderedSizingMetrics(renderItems, groupNormalization);
  }

  const coatFitItem = renderItems.find((item) => item.visualCategory === "outerwear");
  const dressFitItem = renderItems.find((item) => item.visualCategory === "dresses");
  const coatRenderedWidth = renderedSizingMetrics.coat?.renderedFitLineLength ?? null;
  const dressRenderedWidth = renderedSizingMetrics.dress?.renderedFitLineLength ?? null;
  const dressToCoatRatio = renderedSizingMetrics.ratio;
  const transformedGroupBounds = getTransformedGroupBounds(groupNormalization.boundingBox, groupNormalization);
  const sizingEngineDebug = {
    coatUpperFitSource: coatFitItem?.style.sizingDebug?.upperFitSource || coatFitItem?.style.fitSource || null,
    dressUpperFitSource: dressFitItem?.style.sizingDebug?.upperFitSource || dressFitItem?.style.fitSource || null,
    coatUpperFitWidthRatio: coatFitItem?.style.upperFitWidthRatio ?? null,
    dressUpperFitWidthRatio: dressFitItem?.style.upperFitWidthRatio ?? null,
    targetDressToCoatRatio,
    minimumDressToCoatRatio,
    requiredDressBoxWidth: dressFitItem?.style.sizingDebug?.requiredDressBoxWidth ?? dressFitItem?.style.calculatedImageBoxWidth ?? null,
    requiredDressBoxHeight: dressFitItem?.style.sizingDebug?.requiredDressBoxHeight ?? null,
    requiredDressBoxScale: dressFitItem?.style.sizingDebug?.requiredDressBoxScale ?? null,
    boxWidthBeforeClamp: dressFitItem?.style.sizingDebug?.boxWidthBeforeClamp ?? null,
    boxHeightBeforeClamp: dressFitItem?.style.sizingDebug?.boxHeightBeforeClamp ?? null,
    boxWidthAfterClamp: dressFitItem?.style.sizingDebug?.boxWidthAfterClamp ?? dressFitItem?.style.boxWidthPct ?? null,
    boxHeightAfterClamp: dressFitItem?.style.sizingDebug?.boxHeightAfterClamp ?? dressFitItem?.style.boxHeightPct ?? null,
    coatLocalFitRatio: renderedSizingMetrics.coat?.localFitRatio ?? null,
    dressLocalFitRatio: renderedSizingMetrics.dress?.localFitRatio ?? null,
    finalRenderedCoatFitLine: coatRenderedWidth,
    finalRenderedDressFitLine: dressRenderedWidth,
    finalRenderedRatio: dressToCoatRatio,
    transformedGroupBounds,
    finalGroupScale: groupNormalization.scale,
    finalGroupTranslate: { x: groupNormalization.translateX, y: groupNormalization.translateY },
    passFailBasis: "rendered fit line only",
    coatRenderedMeasurement: renderedSizingMetrics.coat,
    dressRenderedMeasurement: renderedSizingMetrics.dress,
  };
  const groupTransform = `translate(${groupNormalization.translateX}%, ${groupNormalization.translateY}%) scale(${groupNormalization.scale})`;

  return (
    <div className="w-full space-y-2">
    <div className="relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden">
      {showDebugAnchors && compositionQaOpen && (
        <>
          <span className="absolute left-1/2 top-0 z-[88] h-full w-px -translate-x-1/2 bg-primary/50" />
          <span className="absolute left-0 top-1/2 z-[88] h-px w-full -translate-y-1/2 bg-primary/50" />
        </>
      )}
      <div className="absolute inset-0 origin-top-left" style={{ transform: groupTransform }}>
      {showDebugAnchors && compositionQaOpen && groupNormalization.boundingBox && (
        <div
          className="absolute z-[89] border border-primary/70"
          style={{
            left: `${groupNormalization.boundingBox.left}%`,
            top: `${groupNormalization.boundingBox.top}%`,
            width: `${groupNormalization.boundingBox.width}%`,
            height: `${groupNormalization.boundingBox.height}%`,
          }}
        />
      )}
      {renderItems.map(({ garment, visualCategory, imageUrl, duplicateIndex, metadata, style, renderedUpperWidth }) => {
        const baseAlt = garment?.name || garment?.category || "Garment";
        const { boxWidthPct, boxHeightPct, offsetXPct, offsetYPct, anchorShiftXPct, anchorShiftYPct, rotationDeg, imageRatio, fitSource: styleFitSource, upperFitWidthRatio, targetRenderedFitWidth, calculatedImageBoxWidth, finalRenderedFitWidth, ...imageStyle } = style;
        const measurementPair = getRealMeasurementPair(metadata, garment?.image_analysis, visualCategory);
        const layoutGroup = metadata.layoutAnchors?.upperFit || metadata.layoutAnchors?.waist || metadata.layoutAnchors?.length;
        const layoutSource = layoutGroup?.source;
        const prioritizedUpperFit = getPrioritizedUpperFit(metadata);
        const fitSource = prioritizedUpperFit?.source || (measurementPair ? ((metadata.validatedMeasurementAnchors?.waist || metadata.measurementAnchors?.waist) as any)?.source : layoutSource) || styleFitSource || "fallback";
        const measurementCenter = measurementPair ? { x: (measurementPair.left.x + measurementPair.right.x) / 2, y: (measurementPair.left.y + measurementPair.right.y) / 2 } : null;
        const landmarkPoints = [
          measurementPair?.left,
          measurementPair?.right,
          toRelativePoint(metadata.necklineCenter || metadata.bodyAnchors?.necklineCenter, garment?.image_analysis),
          toRelativePoint(metadata.waistCenter || metadata.bodyAnchors?.waistCenter, garment?.image_analysis),
          toRelativePoint(metadata.hemCenter || metadata.bodyAnchors?.hemCenter, garment?.image_analysis),
        ].filter(Boolean);
        const mappedMeasurement = measurementPair
          ? { left: mapImagePointToBox(measurementPair.left, style), right: mapImagePointToBox(measurementPair.right, style) }
          : null;
        const mappedLandmarks = landmarkPoints.map((point) => mapImagePointToBox(point!, style));

        return (
          <div key={`${garment?.id ?? imageUrl}-${duplicateIndex}`} className="absolute" style={imageStyle}>
            <img
              src={imageUrl}
              alt={baseAlt}
              loading="lazy"
              decoding="async"
              className={cn("absolute inset-0 h-full w-full object-contain object-center drop-shadow-md")}
            />
            {showDebugAnchors && measurementPair && measurementCenter && mappedMeasurement && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <svg className="absolute inset-0 z-[92] h-full w-full overflow-visible">
                  <line
                    x1={`${mappedMeasurement.left.x}%`}
                    y1={`${mappedMeasurement.left.y}%`}
                    x2={`${mappedMeasurement.right.x}%`}
                    y2={`${mappedMeasurement.right.y}%`}
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  className="absolute z-[93] -translate-x-full -translate-y-[140%] rounded bg-background/90 px-1 py-0.5 text-[8px] font-medium leading-none text-foreground shadow-sm"
                  style={{ left: `${mappedMeasurement.left.x}%`, top: `${mappedMeasurement.left.y}%` }}
                >
                  {measurementPair.leftLabel}
                </span>
                <span
                  className="absolute z-[93] translate-x-1 -translate-y-[140%] rounded bg-background/90 px-1 py-0.5 text-[8px] font-medium leading-none text-foreground shadow-sm"
                  style={{ left: `${mappedMeasurement.right.x}%`, top: `${mappedMeasurement.right.y}%` }}
                >
                  {measurementPair.rightLabel}
                </span>
                {mappedLandmarks.map((point, pointIndex) => (
                  <span
                    key={pointIndex}
                    className="absolute z-[96] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
    {showDebugAnchors && (
      <div className="space-y-2 rounded-xl bg-background/70 p-2 text-[10px] leading-4 text-foreground">
        {hasOuterwear && hasDress && (
          <div className="rounded-lg bg-secondary/20 px-2 py-1 font-medium">
            <div>coat rendered fit line: {coatRenderedWidth?.toFixed(1) ?? "—"} canvas%</div>
            <div>dress rendered fit line: {dressRenderedWidth?.toFixed(1) ?? "—"} canvas%</div>
            <div>coat local fit ratio: {renderedSizingMetrics.coat?.localFitRatio?.toFixed(2) ?? "—"}</div>
            <div>dress local fit ratio: {renderedSizingMetrics.dress?.localFitRatio?.toFixed(2) ?? "—"}</div>
            <div>final dress/coat ratio: {dressToCoatRatio ? dressToCoatRatio.toFixed(2) : "—"}</div>
            <div>target dress/coat fit ratio: {targetDressToCoatRatio.toFixed(2)}</div>
            <div>minimum dress/coat fit ratio: {minimumDressToCoatRatio.toFixed(2)}</div>
          </div>
        )}
        <details open={compositionQaOpen} onToggle={(event) => setCompositionQaOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer font-medium">Composition QA</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({
            canvasSize: { widthPct: 100, heightPct: 100, aspectRatio: canvasAspectRatio },
            canvasCenter: groupNormalization.canvasCenter,
            groupBoundingBox: groupNormalization.boundingBox,
            transformedGroupBounds,
            groupCenter: groupNormalization.groupCenter,
            finalTranslateX: groupNormalization.translateX,
            finalTranslateY: groupNormalization.translateY,
            finalGroupScale: groupNormalization.scale,
            boundingBoxIncludes: "garment visual boxes and measurement overlay only; labels and below-canvas panels excluded",
          }, null, 2)}</pre>
        </details>
        <details open>
          <summary className="cursor-pointer font-medium">Sizing engine QA</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(sizingEngineDebug, null, 2)}</pre>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">Garment fit QA</summary>
          <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(renderItems.map((item) => {
            const metadata = item.metadata;
            const measurementPair = getRealMeasurementPair(metadata, item.garment?.image_analysis, item.visualCategory);
            const prioritizedUpperFit = getPrioritizedUpperFit(metadata);
            const layoutGroup = metadata.layoutAnchors?.upperFit || metadata.layoutAnchors?.waist || metadata.layoutAnchors?.length;
            const fitSource = prioritizedUpperFit?.source || (measurementPair ? ((metadata.validatedMeasurementAnchors?.waist || metadata.measurementAnchors?.waist) as any)?.source : layoutGroup?.source) || item.style.fitSource || "fallback";
            return {
              garment: item.garment?.name || item.garment?.category,
              source: fitSource,
              measuredWidthSpace: "source_image_or_calibrated_anchor_space_not_rotated_screen_space",
              anchorMapping: "source image coordinates → normalized image coordinates → object-contain rendered box coordinates → shared garment wrapper transform",
              calibratedUpperFitWidth: prioritizedUpperFit?.group?.upperBodyFitWidth ?? null,
              upperFitWidthRatio: item.style.upperFitWidthRatio ?? null,
              targetRenderedFitWidth: item.style.targetRenderedFitWidth ?? null,
              calculatedImageBoxWidth: item.style.calculatedImageBoxWidth ?? null,
              requiredDressBoxWidth: item.style.sizingDebug?.requiredDressBoxWidth ?? null,
              requiredDressBoxHeight: item.style.sizingDebug?.requiredDressBoxHeight ?? null,
              localFitRatio: item.visualCategory === "outerwear" ? renderedSizingMetrics.coat?.localFitRatio ?? null : item.visualCategory === "dresses" ? renderedSizingMetrics.dress?.localFitRatio ?? null : measurementPair?.width ?? null,
              renderedFitLine: item.visualCategory === "outerwear" ? renderedSizingMetrics.coat?.renderedFitLineLength ?? null : item.visualCategory === "dresses" ? renderedSizingMetrics.dress?.renderedFitLineLength ?? null : null,
              finalCanvasAnchorPoints: item.visualCategory === "outerwear" ? {
                left: renderedSizingMetrics.coat?.finalLeftAnchorCanvasPoint ?? null,
                right: renderedSizingMetrics.coat?.finalRightAnchorCanvasPoint ?? null,
              } : item.visualCategory === "dresses" ? {
                left: renderedSizingMetrics.dress?.finalLeftAnchorCanvasPoint ?? null,
                right: renderedSizingMetrics.dress?.finalRightAnchorCanvasPoint ?? null,
              } : null,
              boxWidthBeforeClamp: item.style.sizingDebug?.boxWidthBeforeClamp ?? null,
              boxWidthAfterClamp: item.style.sizingDebug?.boxWidthAfterClamp ?? item.style.boxWidthPct ?? null,
              boxHeightBeforeClamp: item.style.sizingDebug?.boxHeightBeforeClamp ?? null,
              boxHeightAfterClamp: item.style.sizingDebug?.boxHeightAfterClamp ?? item.style.boxHeightPct ?? null,
              finalRenderedFitWidth: item.style.finalRenderedFitWidth ?? item.renderedUpperWidth ?? null,
              rawAiLandmarks: metadata.rawAiLandmarks,
              validatedMeasurementAnchors: metadata.validatedMeasurementAnchors || metadata.measurementAnchors,
              layoutAnchors: metadata.layoutAnchors,
            };
          }), null, 2)}</pre>
        </details>
      </div>
    )}
    </div>
  );
};

export default OutfitCollage;