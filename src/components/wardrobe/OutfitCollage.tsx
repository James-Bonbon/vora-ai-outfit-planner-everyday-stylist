import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type OutfitCollageProps = {
  garments: any[];
  debugAnchors?: boolean;
  debugLegacyAnchors?: boolean;
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

type FitBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  source?: "human" | "ai" | "alpha_profile" | "ratio_guard" | string;
  confidence?: number;
  validationStatus?: "validated" | "estimated" | "failed" | "warning" | string;
  notes?: string;
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
  fitBox?: FitBox | null;
  anchorNormalization?: string;
  anchorSources?: Record<string, "ai" | "alpha_profile" | "alpha_estimate" | "ratio_guard" | string>;
  rawAiLandmarks?: any;
  validatedMeasurementAnchors?: {
    upperFit?: FitGroup;
    waist?: FitGroup;
    lowerHemFit?: FitGroup;
    hipFit?: FitGroup;
    lengthFit?: FitGroup;
  };
  measurementAnchors?: LayoutMetadata["validatedMeasurementAnchors"];
  layoutAnchors?: {
    upperFit?: FitGroup;
    waist?: FitGroup;
    lowerHemFit?: FitGroup;
    hipFit?: FitGroup;
    lengthFit?: FitGroup;
    length?: FitGroup;
  };
  invalidAnchors?: Array<{ anchor: string; source?: string; reasons: string[]; confidence?: number }>;
  fitValidation?: { status?: string; rejected?: string[]; invalidAnchors?: Array<{ anchor: string; source?: string; reasons: string[]; confidence?: number }> };
  bodyAnchors?: {
    leftShoulder?: { x: number; y: number };
    rightShoulder?: { x: number; y: number };
    necklineCenter?: { x: number; y: number };
    waistCenter?: { x: number; y: number };
    hemCenter?: { x: number; y: number };
  };
};

type FitGroup = Record<string, any> & { confidence?: number; source?: string; notes?: string; validationStatus?: string; failureReason?: string };
type FitAnchorType = "upperFit" | "waist" | "lowerHemFit" | "hipFit" | "lengthFit";
const activeLegacyAnchorFields = ["leftUpperAnchor", "rightUpperAnchor", "upperBodyWidthAnchor", "leftWaistAnchor", "rightWaistAnchor", "validatedMeasurementAnchors", "measurementAnchors", "layoutAnchors"] as const;

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
    lengthFitSource?: string | null;
    lengthFitRatio?: number | null;
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
    relationshipRule?: string | null;
    relationshipScale?: number | null;
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
  safePaddingPct: number;
  targetOccupancyPct: number;
  occupancyWidthPct: number;
  occupancyHeightPct: number;
};

type ItemBounds = { left: number; top: number; right: number; bottom: number; width: number; height: number; center: { x: number; y: number } };
type ZoneName = "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "rightColumn";
type ZoneRect = { left: number; top: number; right: number; bottom: number; width: number; height: number; center: { x: number; y: number } };
type OutfitArchetype = "top_bottom" | "top_bottom_outerwear" | "dress" | "dress_outerwear" | "full_body_outerwear" | "accessories_only";
type RelationshipCheck = {
  rule: string;
  anchorsOrBoundsUsed: string;
  targetRatio?: string;
  currentRatio?: number | null;
  preResizeRatio?: number | null;
  resizeTargetRatio?: number | null;
  resizedGarment?: string | null;
  resizeScaleApplied?: number | null;
  postResizeTopWidth?: number | null;
  postResizeBottomWidth?: number | null;
  finalPostResizeRatio?: number | null;
  resizeHappened?: boolean;
  verticalOverlapGap?: number | null;
  horizontalCenterOffset?: number | null;
  status: "OK" | "Adjusted" | "Warning";
  warning?: string;
};
type RelationshipSolverDebug = {
  outfitArchetype: OutfitArchetype;
  selectedRelationshipRule: string;
  constraintsApplied: string[];
  relationshipChecks: RelationshipCheck[];
  warnings: string[];
  finalVerticalOverlapGap: number | null;
  finalHorizontalCenterOffset: number | null;
  targetRatio: string;
  finalRatio: number | null;
  comparedAnchors: Record<string, any>;
  renderedAnchorLineLengths: Record<string, number | null>;
};

type CompositionMetrics = {
  selectedLayoutTemplate: string;
  garmentCenters: Record<string, { x: number; y: number }>;
  garmentBounds: Record<string, ItemBounds>;
  garmentZoneAssignments: Array<{
    garmentName: string;
    category: VisualCategory;
    assignedZone: ZoneName;
    finalBounds: ItemBounds;
    overlapAmount: number;
  }>;
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
  if (/\b(shoes?|sneakers?|boots?|heels?|loafers?|sandals?|trainers?)\b/.test(text)) return "shoes";
  if (/\b(dress|dresses|gown|jumpsuit|romper|one[-\s]?piece)\b/.test(text)) return "dresses";
  if (/\b(outerwear|jacket|coat|blazer|trench|parka|cardigan|shacket)\b/.test(text)) return "outerwear";
  if (/\b(bottoms?|trousers?|pants?|jeans?|skirts?|shorts?|chinos?|sweatpants?|leggings?)\b/.test(text) && !/\bshort[-\s]?sleeve\b/.test(text)) return "bottoms";
  if (/\b(bags?|purses?|totes?|clutches|backpacks?|handbags?|accessor(?:y|ies)|belts?|scarves|jewelry|jewellery|sunglasses)\b/.test(text)) return "accessories";
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

const roleInitialLayouts: Record<VisualCategory, { x: number; y: number; rotate: number; zIndex: number }> = {
  outerwear: { x: 10, y: 12, rotate: -4, zIndex: 20 },
  dresses: { x: 42, y: 11, rotate: 2, zIndex: 30 },
  tops: { x: 44, y: 14, rotate: -1, zIndex: 35 },
  bottoms: { x: 45, y: 46, rotate: 1, zIndex: 32 },
  shoes: { x: 15, y: 68, rotate: -6, zIndex: 50 },
  hats: { x: 13, y: 58, rotate: 5, zIndex: 52 },
  accessories: { x: 13, y: 61, rotate: 5, zIndex: 52 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundMetric = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;

const canvasAspectRatio = 3 / 4;

const makeZone = (left: number, top: number, right: number, bottom: number): ZoneRect => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  center: { x: (left + right) / 2, y: (top + bottom) / 2 },
});

const fourZoneRects: Record<ZoneName, ZoneRect> = {
  topLeft: makeZone(8, 16, 48, 52),
  topRight: makeZone(42, 12, 92, 52),
  bottomLeft: makeZone(8, 52, 45, 88),
  bottomRight: makeZone(45, 45, 92, 90),
  rightColumn: makeZone(42, 12, 92, 90),
};

const getAssignedZone = (visualCategory: VisualCategory): ZoneName => {
  if (visualCategory === "outerwear") return "topLeft";
  if (visualCategory === "dresses") return "rightColumn";
  if (visualCategory === "tops") return "topRight";
  if (visualCategory === "bottoms") return "bottomRight";
  return "bottomLeft";
};

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

const toRelativeFitBox = (box: FitBox | null | undefined, analysis?: ImageAnalysis | null) => {
  if (!box || box.validationStatus === "failed" || (box.source !== "human" && Number(box.confidence ?? 0) < 0.5)) return null;
  const imageWidth = Number(analysis?.imageWidth) || 1;
  const imageHeight = Number(analysis?.imageHeight) || 1;
  const x = Number(box.x);
  const y = Number(box.y);
  const width = Number(box.width);
  const height = Number(box.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {
    x: clamp(x > 1 ? x / imageWidth : x, 0, 1),
    y: clamp(y > 1 ? y / imageHeight : y, 0, 1),
    width: clamp(width > 1 ? width / imageWidth : width, 0.04, 1),
    height: clamp(height > 1 ? height / imageHeight : height, 0.04, 1),
    source: box.source || "fallback",
    confidence: Number(box.confidence ?? 0),
    validationStatus: box.validationStatus || "estimated",
    notes: box.notes,
  };
};

const getPrioritizedFitBox = (metadata: LayoutMetadata, analysis?: ImageAnalysis | null) => toRelativeFitBox(metadata.fitBox, analysis);

const hasActiveLegacyAnchors = (metadata: LayoutMetadata) => activeLegacyAnchorFields.some((field) => (metadata as any)?.[field] != null);

const archiveLegacyAnchorFields = (metadata: LayoutMetadata) => {
  const legacyAnchors = { ...((metadata as any)?.legacyAnchors || {}) };
  activeLegacyAnchorFields.forEach((field) => {
    if ((metadata as any)?.[field] != null) legacyAnchors[field] = (metadata as any)[field];
  });
  const next = { ...(metadata as any), legacyAnchors: Object.keys(legacyAnchors).length ? legacyAnchors : undefined };
  activeLegacyAnchorFields.forEach((field) => delete next[field]);
  return next;
};

const getLegacyDebugMetadata = (metadata: LayoutMetadata) => ({ ...metadata, ...((metadata as any).legacyAnchors || {}) });

const getPrioritizedUpperFit = (metadata: LayoutMetadata) => {
  return getPrioritizedFitGroup(metadata, "upperFit");
};

const getPrioritizedFitGroup = (metadata: LayoutMetadata, anchorType: FitAnchorType) => {
  const validated = metadata.validatedMeasurementAnchors?.[anchorType];
  const measurement = metadata.measurementAnchors?.[anchorType];
  const layout = metadata.layoutAnchors?.[anchorType] || (anchorType === "lowerHemFit" ? metadata.layoutAnchors?.length : undefined);
  const human = [validated, measurement].find((group) => group?.source === "human");
  const ai = [validated, measurement].find((group) => group?.source === "ai" && group.validationStatus !== "failed" && Number(group.confidence) >= 0.5);
  if (human) return { group: human, source: "human", isMeasurement: true };
  if (ai) return { group: ai, source: "ai", isMeasurement: true };
  if (layout?.source === "alpha_profile" && layout.validationStatus !== "failed" && Number(layout.confidence) >= 0.5) return { group: layout, source: "alpha_profile", isMeasurement: true };
  if (layout?.source === "ratio_guard") return { group: layout, source: "ratio_guard", isMeasurement: false };
  if (layout) return { group: layout, source: layout.source || "fallback", isMeasurement: false };
  return null;
};

const getFitWidthFromGroup = (group: FitGroup | undefined, anchorType: FitAnchorType, analysis?: ImageAnalysis | null) => {
  const widthKey: Record<FitAnchorType, string[]> = {
    upperFit: ["upperBodyFitWidth"],
    waist: ["waistFitWidth", "waistWidth"],
    lowerHemFit: ["lowerHemFitWidth", "hemFitWidth"],
    hipFit: ["hipFitWidth"],
    lengthFit: ["lengthFitHeight"],
  };
  for (const key of widthKey[anchorType]) {
    const ratio = widthToRatio(Number(group?.[key]), anchorType === "lengthFit" ? { imageWidth: analysis?.imageHeight } as ImageAnalysis : analysis);
    if (ratio) return ratio;
  }
  const pair = getAnchorPairFromGroup(group, anchorType, analysis);
  return pair?.width ?? null;
};

const getAnchorPairFromGroup = (group: FitGroup | undefined, anchorType: FitAnchorType, analysis?: ImageAnalysis | null) => {
  const keys: Record<FitAnchorType, [string, string, string, string]> = {
    upperFit: ["leftUpperFitAnchor", "rightUpperFitAnchor", "L upper", "R upper"],
    waist: ["leftWaistAnchor", "rightWaistAnchor", "L waist", "R waist"],
    lowerHemFit: ["leftLowerHemFitAnchor", "rightLowerHemFitAnchor", "L hem", "R hem"],
    hipFit: ["leftHipFitAnchor", "rightHipFitAnchor", "L hip", "R hip"],
    lengthFit: ["topLengthFitAnchor", "bottomLengthFitAnchor", "Top length", "Bottom length"],
  };
  const [leftKey, rightKey, leftLabel, rightLabel] = keys[anchorType];
  const left = toRelativePoint(group?.[leftKey], analysis);
  const right = toRelativePoint(group?.[rightKey], analysis);
  if (!left || !right) return null;
  const width = anchorType === "lengthFit" ? Math.abs(right.y - left.y) : Math.abs(right.x - left.x);
  return width > 0.08 ? { left, right, width: clamp(width, 0.08, 1), leftLabel, rightLabel, fullLabel: `${leftKey} → ${rightKey}`, source: group?.source, confidence: group?.confidence, validationStatus: group?.validationStatus || (group?.source === "human" || group?.source === "ai" ? "validated" : "estimated") } : null;
};

const pointNearGarment = (point: { x: number; y: number }, analysis?: ImageAnalysis | null, radiusPx = 10) => {
  const fullWidth = Number(analysis?.imageWidth) || 1;
  const fullHeight = Number(analysis?.imageHeight) || 1;
  const x = point.x <= 1 ? point.x * fullWidth : point.x;
  const y = point.y <= 1 ? point.y * fullHeight : point.y;
  const mask = (analysis as any)?.alphaMask;
  if (mask?.width && mask?.height && mask.data) {
    const mx = clamp(Math.round((x / fullWidth) * (mask.width - 1)), 0, mask.width - 1);
    const my = clamp(Math.round((y / fullHeight) * (mask.height - 1)), 0, mask.height - 1);
    const rx = Math.max(1, Math.ceil((radiusPx / fullWidth) * mask.width));
    const ry = Math.max(1, Math.ceil((radiusPx / fullHeight) * mask.height));
    for (let yy = my - ry; yy <= my + ry; yy++) for (let xx = mx - rx; xx <= mx + rx; xx++) {
      if (xx >= 0 && yy >= 0 && xx < mask.width && yy < mask.height && mask.data[yy * mask.width + xx] === "1") return true;
    }
    return false;
  }
  const extent = (analysis as any)?.alphaRowExtents?.[Math.round(y)];
  return !extent || (x >= extent.left - radiusPx && x <= extent.right + radiusPx);
};

const pairValidForSizing = (pair: ReturnType<typeof getAnchorPairFromGroup>, analysis?: ImageAnalysis | null) => {
  if (!pair || pair.source === "human") return true;
  if (pair.validationStatus === "failed" || pair.source === "ratio_guard" || Number(pair.confidence) < 0.5) return false;
  if (!pointNearGarment(pair.left, analysis) || !pointNearGarment(pair.right, analysis)) return false;
  let hits = 0;
  const samples = 16;
  for (let index = 0; index <= samples; index++) {
    const t = index / samples;
    if (pointNearGarment({ x: pair.left.x + (pair.right.x - pair.left.x) * t, y: pair.left.y + (pair.right.y - pair.left.y) * t }, analysis, 8)) hits += 1;
  }
  return hits / (samples + 1) >= 0.42;
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

const getMeasurementPair = (metadata: LayoutMetadata, analysis: ImageAnalysis | null | undefined, anchorType: FitAnchorType, measurementsOnly = false) => {
  const prioritized = getPrioritizedFitGroup(metadata, anchorType);
  if (!prioritized?.group) return null;
  if (measurementsOnly && (!prioritized.isMeasurement || !["ai", "human", "alpha_profile"].includes(String(prioritized.source)) || Number(prioritized.group.confidence) < 0.5)) return null;
  const pair = getAnchorPairFromGroup(prioritized.group, anchorType, analysis);
  return pairValidForSizing(pair, analysis) || prioritized.source === "ratio_guard" && !measurementsOnly ? pair : null;
};

const getRealMeasurementPair = (metadata: LayoutMetadata, analysis: ImageAnalysis | null | undefined, visualCategory: VisualCategory) => {
  const defaultAnchor: Partial<Record<VisualCategory, FitAnchorType>> = { outerwear: "upperFit", dresses: "upperFit", tops: "upperFit", bottoms: "waist" };
  const anchorType = defaultAnchor[visualCategory];
  return anchorType ? getMeasurementPair(metadata, analysis, anchorType, true) : null;
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
  const fitBox = getPrioritizedFitBox(metadata, analysis);
  const verticalFitRatio = fitBox?.height || visibleHeightRatio;
  const imageRatio = analysis?.imageWidth && analysis?.imageHeight ? analysis.imageWidth / analysis.imageHeight : 1;
  const visibleAspect = analysis?.visibleWidth && analysis?.visibleHeight ? analysis.visibleWidth / analysis.visibleHeight : imageRatio;
  const preferredScale = clamp(Number(metadata.preferredPreviewScale) || 0.55, 0.2, 1);
  const intendedVisibleWidth = clamp(intendedVisibleHeight * visibleAspect * (0.82 + preferredScale * 0.24), 22, 66);
  const boxHeight = clamp(intendedVisibleHeight / verticalFitRatio, 22, 88);
  const upperBodyWidthRatio = fitBox?.width || null;
  const fitSource = fitBox?.source ? `fitBox:${fitBox.source}` : "visual fallback";
  const upperAnchorBoxWidth = upperBodyWidthRatio && targetRenderedShoulderWidth
    ? targetRenderedShoulderWidth / upperBodyWidthRatio
    : null;
  const widthClampMax = upperAnchorBoxWidth ? (fitBox?.source === "human" ? 166 : 122) : 92;
  const boxWidth = clamp(Math.max(intendedVisibleWidth / visibleWidthRatio, upperAnchorBoxWidth || 0), 22, widthClampMax);
  const visibleCenterX = analysis?.imageWidth && analysis?.visibleWidth
    ? ((analysis.visibleX ?? 0) + analysis.visibleWidth / 2) / analysis.imageWidth
    : 0.5;
  const visibleCenterY = fitBox
    ? clamp(fitBox.y + fitBox.height / 2, 0, 1)
    : analysis?.imageHeight && analysis?.visibleHeight
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
      lengthFitSource: fitBox?.source || null,
      lengthFitRatio: fitBox?.height || null,
      upperFitWidthRatio: upperBodyWidthRatio,
      boxWidthBeforeClamp: Math.max(intendedVisibleWidth / visibleWidthRatio, upperAnchorBoxWidth || 0),
      boxWidthAfterClamp: boxWidth,
      finalRenderedFitWidth: upperBodyWidthRatio ? upperBodyWidthRatio * boxWidth : null,
    },
  };
};

const getItemVisualBounds = (style: NormalizedRenderStyle, analysis?: ImageAnalysis | null, visualCategory?: VisualCategory): ItemBounds => {
  const left = Number.parseFloat(String(style.left ?? 0));
  const top = Number.parseFloat(String(style.top ?? 0));
  const translatedLeft = left + (style.offsetXPct / 100) * style.boxWidthPct;
  const translatedTop = top + (style.offsetYPct / 100) * style.boxHeightPct;
  const imageRect = getObjectContainRect(style.boxWidthPct, style.boxHeightPct, style.imageRatio);
  const visibleLeftRatio = analysis?.imageWidth && analysis?.visibleWidth ? clamp((analysis.visibleX ?? 0) / analysis.imageWidth, 0, 1) : 0;
  const visibleTopRatio = analysis?.imageHeight && analysis?.visibleHeight ? clamp((analysis.visibleY ?? 0) / analysis.imageHeight, 0, 1) : 0;
  const visibleWidthRatio = analysis?.imageWidth && analysis?.visibleWidth ? clamp(analysis.visibleWidth / analysis.imageWidth, 0.05, 1) : 1;
  const visibleHeightRatio = analysis?.imageHeight && analysis?.visibleHeight ? clamp(analysis.visibleHeight / analysis.imageHeight, 0.05, 1) : 1;
  const imageLeft = translatedLeft + ((imageRect.left + visibleLeftRatio * imageRect.width) / 100) * style.boxWidthPct;
  const imageTop = translatedTop + ((imageRect.top + visibleTopRatio * imageRect.height) / 100) * style.boxHeightPct;
  const imageWidth = ((imageRect.width * visibleWidthRatio) / 100) * style.boxWidthPct;
  const imageHeight = ((imageRect.height * visibleHeightRatio) / 100) * style.boxHeightPct;
  const center = { x: translatedLeft + style.boxWidthPct / 2, y: translatedTop + style.boxHeightPct / 2 };
  const corners = [
    { x: imageLeft, y: imageTop },
    { x: imageLeft + imageWidth, y: imageTop },
    { x: imageLeft + imageWidth, y: imageTop + imageHeight },
    { x: imageLeft, y: imageTop + imageHeight },
  ].map((point) => rotateCanvasPoint(point, center, style.rotationDeg));
  const rawBox = corners.reduce(
    (acc, point) => ({ left: Math.min(acc.left, point.x), top: Math.min(acc.top, point.y), right: Math.max(acc.right, point.x), bottom: Math.max(acc.bottom, point.y) }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );
  const categoryWidthFactor = visualCategory === "dresses" ? 0.46 : visualCategory === "outerwear" ? 0.62 : 1;
  const categoryHeightFactor = visualCategory === "dresses" ? 0.9 : visualCategory === "outerwear" ? 0.86 : 1;
  const rawWidth = rawBox.right - rawBox.left;
  const rawHeight = rawBox.bottom - rawBox.top;
  const rawCenter = { x: (rawBox.left + rawBox.right) / 2, y: (rawBox.top + rawBox.bottom) / 2 };
  const box = {
    left: rawCenter.x - (rawWidth * categoryWidthFactor) / 2,
    right: rawCenter.x + (rawWidth * categoryWidthFactor) / 2,
    top: rawCenter.y - (rawHeight * categoryHeightFactor) / 2,
    bottom: rawCenter.y + (rawHeight * categoryHeightFactor) / 2,
  };
  return { ...box, width: box.right - box.left, height: box.bottom - box.top, center: { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } };
};

const normalizeOutfitGroup = (items: Array<{ style: NormalizedRenderStyle }>): GroupNormalization => {
  const canvasCenter = { x: 50, y: 50 };
  const safePaddingPct = 9;
  const targetOccupancyPct = items.length <= 2 ? 78 : items.length <= 4 ? 80 : 82;
  if (!items.length) return { canvasCenter, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1, safePaddingPct, targetOccupancyPct, occupancyWidthPct: 0, occupancyHeightPct: 0 };

  const boxes = items.map(({ style, garment, visualCategory }: { style: NormalizedRenderStyle; garment?: any; visualCategory?: VisualCategory }) => getItemVisualBounds(style, garment?.image_analysis, visualCategory));

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
  const safeCanvasPct = 100 - safePaddingPct * 2;
  const scale = clamp(
    Math.min(
      targetOccupancyPct / Math.max(boundingBox.width, boundingBox.height, 1),
      safeCanvasPct / Math.max(boundingBox.width, 1),
      safeCanvasPct / Math.max(boundingBox.height, 1)
    ),
    0.04,
    8
  );
  return {
    canvasCenter,
    boundingBox,
    groupCenter,
    translateX: canvasCenter.x - groupCenter.x * scale,
    translateY: canvasCenter.y - groupCenter.y * scale,
    scale,
    safePaddingPct,
    targetOccupancyPct,
    occupancyWidthPct: boundingBox.width * scale,
    occupancyHeightPct: boundingBox.height * scale,
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
  const fitBox = getPrioritizedFitBox(item.metadata, item.garment?.image_analysis);
  if (fitBox) return getRenderedFitBoxMeasurement(item, groupNormalization, fitBox);
  return null;
};

const getRenderedLegacyMeasurement = (item: RenderItem | undefined, groupNormalization: GroupNormalization) => {
  if (!item) return null;
  const measurementPair = getRealMeasurementPair(item.metadata, item.garment?.image_analysis, item.visualCategory);
  return getRenderedAnchorMeasurement(item, groupNormalization, measurementPair);
};

const getRenderedFitBoxMeasurement = (item: RenderItem, groupNormalization: GroupNormalization, fitBox: NonNullable<ReturnType<typeof getPrioritizedFitBox>>) => {
  const leftPoint = { x: fitBox.x, y: fitBox.y };
  const rightPoint = { x: fitBox.x + fitBox.width, y: fitBox.y };
  const bottomPoint = { x: fitBox.x + fitBox.width / 2, y: fitBox.y + fitBox.height };
  const leftCanvas = mapMeasurementPointToCanvas(leftPoint, item.style, groupNormalization);
  const rightCanvas = mapMeasurementPointToCanvas(rightPoint, item.style, groupNormalization);
  const bottomCanvas = mapMeasurementPointToCanvas(bottomPoint, item.style, groupNormalization);
  return {
    localFitRatio: fitBox.width,
    localFitHeightRatio: fitBox.height,
    anchorType: "fitBox",
    source: fitBox.source,
    confidence: fitBox.confidence,
    validationStatus: fitBox.validationStatus,
    sourceFitBox: fitBox,
    finalLeftAnchorCanvasPoint: { x: leftCanvas.x, y: leftCanvas.y },
    finalRightAnchorCanvasPoint: { x: rightCanvas.x, y: rightCanvas.y },
    finalBottomCanvasPoint: { x: bottomCanvas.x, y: bottomCanvas.y },
    objectContainRect: leftCanvas.objectContainRect,
    renderedFitLineLength: getCanvasDistance(leftCanvas, rightCanvas),
    renderedFitBoxHeight: getCanvasDistance(leftCanvas, bottomCanvas),
  };
};

const getRenderedAnchorMeasurement = (item: RenderItem | undefined, groupNormalization: GroupNormalization, measurementPair: ReturnType<typeof getAnchorPairFromGroup> | null) => {
  if (!item) return null;
  if (!measurementPair) return null;
  const leftCanvas = mapMeasurementPointToCanvas(measurementPair.left, item.style, groupNormalization);
  const rightCanvas = mapMeasurementPointToCanvas(measurementPair.right, item.style, groupNormalization);
  const renderedFitLineLength = getCanvasDistance(leftCanvas, rightCanvas);
  return {
    localFitRatio: measurementPair.width,
    anchorType: measurementPair.fullLabel,
    source: measurementPair.source,
    confidence: measurementPair.confidence,
    validationStatus: measurementPair.validationStatus,
    sourceLeftAnchor: measurementPair.left,
    sourceRightAnchor: measurementPair.right,
    finalLeftAnchorCanvasPoint: { x: leftCanvas.x, y: leftCanvas.y },
    finalRightAnchorCanvasPoint: { x: rightCanvas.x, y: rightCanvas.y },
    objectContainRect: leftCanvas.objectContainRect,
    renderedFitLineLength,
  };
};

const relationshipRules = [
  { id: "top_bottom_fitBox_to_fitBox", a: "tops", b: "bottoms", target: [0.82, 1.08], oversizedMax: 1.22 },
  { id: "outerwear_top_fitBox_to_fitBox", a: "tops", b: "outerwear", target: [0.8, 0.95] },
  { id: "outerwear_dress_fitBox_to_fitBox", a: "dresses", b: "outerwear", target: [0.8, 0.95] },
  { id: "dress_alone_fitBox", a: "dresses", b: null, target: [0.8, 1.05] },
] as const;

const getSelectedRelationshipRule = (items: RenderItem[]) => {
  const has = (category: VisualCategory) => items.some((item) => item.visualCategory === category);
  if (has("tops") && has("bottoms")) return relationshipRules[0];
  if (has("outerwear") && has("tops")) return relationshipRules[1];
  if (has("outerwear") && has("dresses")) return relationshipRules[2];
  if (has("dresses")) return relationshipRules[3];
  return null;
};

const getRelationshipMetrics = (items: RenderItem[], groupNormalization: GroupNormalization) => {
  const rule = getSelectedRelationshipRule(items);
  if (!rule) return null;
  const primary = items.find((item) => item.visualCategory === rule.a);
  const secondary = rule.b ? items.find((item) => item.visualCategory === rule.b) : primary;
  const primaryRendered = getRenderedMeasurement(primary, groupNormalization);
  const secondaryRendered = getRenderedMeasurement(secondary, groupNormalization);
  const finalRatio = primaryRendered?.renderedFitLineLength && secondaryRendered?.renderedFitLineLength ? primaryRendered.renderedFitLineLength / secondaryRendered.renderedFitLineLength : null;
  return {
    selectedRelationshipRule: rule.id,
    comparedAnchors: {
      primary: { garment: primary?.garment?.name || primary?.visualCategory, category: primary?.visualCategory, anchor: "fitBox width", source: primaryRendered?.source || null },
      secondary: { garment: secondary?.garment?.name || secondary?.visualCategory, category: secondary?.visualCategory, anchor: "fitBox width", source: secondaryRendered?.source || null },
    },
    renderedAnchorLineLengths: { primary: primaryRendered?.renderedFitLineLength ?? null, secondary: secondaryRendered?.renderedFitLineLength ?? null },
    targetRatio: `${rule.target[0].toFixed(2)}–${rule.target[1].toFixed(2)}${"oversizedMax" in rule ? ` (oversized max ${rule.oversizedMax.toFixed(2)})` : ""}`,
    finalRatio,
    primaryRendered,
    secondaryRendered,
  };
};

const scaleRelationshipPrimaryToTarget = (items: RenderItem[], groupNormalization: GroupNormalization) => {
  const metrics = getRelationshipMetrics(items, groupNormalization);
  if (!metrics?.finalRatio) return items;
  const rule = getSelectedRelationshipRule(items);
  if (!rule || rule.id === "dress_alone_fitBox") return items;
  if (rule.id === "top_bottom_fitBox_to_fitBox" || rule.id === "outerwear_top_fitBox_to_fitBox") return items;
  const targetMid = (rule.target[0] + rule.target[1]) / 2;
  const upperAllowed = Number("oversizedMax" in rule ? rule.oversizedMax : rule.target[1]);
  if (metrics.finalRatio >= rule.target[0] && metrics.finalRatio <= upperAllowed) return items;
  const scale = clamp(targetMid / Math.max(metrics.finalRatio, 0.001), 0.72, 1.38);
  return items.map((item) => {
    if (item.visualCategory !== rule.a) return item;
    const nextWidth = item.style.boxWidthPct * scale;
    const nextHeight = item.style.boxHeightPct * scale;
    return {
      ...item,
      style: {
        ...item.style,
        width: `${nextWidth}%`,
        height: `${nextHeight}%`,
        boxWidthPct: nextWidth,
        boxHeightPct: nextHeight,
        finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.finalRenderedFitWidth,
        sizingDebug: { ...item.style.sizingDebug, relationshipRule: rule.id, relationshipScale: scale, boxWidthAfterClamp: nextWidth, boxHeightAfterClamp: nextHeight } as any,
      },
    };
  });
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

const withVisualCenter = (item: RenderItem, targetCenter: { x: number; y: number }): RenderItem => {
  const bounds = getItemVisualBounds(item.style, item.garment?.image_analysis, item.visualCategory);
  const dx = targetCenter.x - bounds.center.x;
  const dy = targetCenter.y - bounds.center.y;
  const nextLeft = Number.parseFloat(String(item.style.left ?? 0)) + dx;
  const nextTop = Number.parseFloat(String(item.style.top ?? 0)) + dy;
  return { ...item, style: { ...item.style, left: `${nextLeft}%`, top: `${nextTop}%` } };
};

const fitItemIntoZone = (item: RenderItem, zoneName: ZoneName, fillRatio = 0.9): RenderItem => {
  const zone = fourZoneRects[zoneName];
  const fitZone = item.visualCategory === "outerwear" && zoneName === "topLeft" ? makeZone(8, 16, 54, 88) : zone;
  const bounds = getItemVisualBounds(item.style, item.garment?.image_analysis, item.visualCategory);
  const maxScale = ["outerwear", "dresses", "tops", "bottoms"].includes(item.visualCategory) ? 1 : 1.45;
  const scale = clamp(Math.min((fitZone.width * fillRatio) / Math.max(bounds.width, 1), (fitZone.height * fillRatio) / Math.max(bounds.height, 1)), 0.55, maxScale);
  const nextStyle = {
    ...item.style,
    width: `${item.style.boxWidthPct * scale}%`,
    height: `${item.style.boxHeightPct * scale}%`,
    boxWidthPct: item.style.boxWidthPct * scale,
    boxHeightPct: item.style.boxHeightPct * scale,
    finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.finalRenderedFitWidth,
    sizingDebug: {
      ...item.style.sizingDebug,
      boxWidthAfterClamp: item.style.boxWidthPct * scale,
      boxHeightAfterClamp: item.style.boxHeightPct * scale,
      finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.sizingDebug?.finalRenderedFitWidth,
    },
  };
  return withVisualCenter({ ...item, style: nextStyle }, fitZone.center);
};

const getFitBoxCanvasRectBeforeNormalization = (item: RenderItem) => {
  const fitBox = getPrioritizedFitBox(item.metadata, item.garment?.image_analysis);
  const bounds = getItemVisualBounds(item.style, item.garment?.image_analysis, item.visualCategory);
  if (!fitBox) {
    const top = item.visualCategory === "bottoms" ? bounds.top : bounds.top + bounds.height * 0.12;
    const bottom = item.visualCategory === "tops" ? bounds.top + bounds.height * 0.88 : bounds.bottom;
    return {
      left: bounds.left,
      right: bounds.right,
      top,
      bottom,
      width: bounds.width,
      height: Math.max(1, bottom - top),
      center: { x: bounds.center.x, y: (top + bottom) / 2 },
      source: "visual bounds",
    };
  }
  const points = [
    mapMeasurementPointToCanvas({ x: fitBox.x, y: fitBox.y }, item.style, { canvasCenter: { x: 0, y: 0 }, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1, safePaddingPct: 0, targetOccupancyPct: 0, occupancyWidthPct: 0, occupancyHeightPct: 0 }),
    mapMeasurementPointToCanvas({ x: fitBox.x + fitBox.width, y: fitBox.y }, item.style, { canvasCenter: { x: 0, y: 0 }, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1, safePaddingPct: 0, targetOccupancyPct: 0, occupancyWidthPct: 0, occupancyHeightPct: 0 }),
    mapMeasurementPointToCanvas({ x: fitBox.x + fitBox.width, y: fitBox.y + fitBox.height }, item.style, { canvasCenter: { x: 0, y: 0 }, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1, safePaddingPct: 0, targetOccupancyPct: 0, occupancyWidthPct: 0, occupancyHeightPct: 0 }),
    mapMeasurementPointToCanvas({ x: fitBox.x, y: fitBox.y + fitBox.height }, item.style, { canvasCenter: { x: 0, y: 0 }, boundingBox: null, groupCenter: null, translateX: 0, translateY: 0, scale: 1, safePaddingPct: 0, targetOccupancyPct: 0, occupancyWidthPct: 0, occupancyHeightPct: 0 }),
  ];
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return { left, right, top, bottom, width: right - left, height: bottom - top, center: { x: (left + right) / 2, y: (top + bottom) / 2 }, source: `fitBox:${fitBox.source}` };
};

const offsetItem = (item: RenderItem, dx: number, dy: number): RenderItem => ({
  ...item,
  style: {
    ...item.style,
    left: `${Number.parseFloat(String(item.style.left ?? 0)) + dx}%`,
    top: `${Number.parseFloat(String(item.style.top ?? 0)) + dy}%`,
  },
});

const scaleItemAroundFitBoxCenter = (item: RenderItem, scale: number, relationshipRule: string): RenderItem => {
  const beforeBox = getFitBoxCanvasRectBeforeNormalization(item);
  const nextWidth = item.style.boxWidthPct * scale;
  const nextHeight = item.style.boxHeightPct * scale;
  const nextItem: RenderItem = {
    ...item,
    style: {
      ...item.style,
      width: `${nextWidth}%`,
      height: `${nextHeight}%`,
      boxWidthPct: nextWidth,
      boxHeightPct: nextHeight,
      finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.finalRenderedFitWidth,
      sizingDebug: {
        ...item.style.sizingDebug,
        relationshipRule,
        relationshipScale: scale,
        boxWidthAfterClamp: nextWidth,
        boxHeightAfterClamp: nextHeight,
        finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.sizingDebug?.finalRenderedFitWidth,
      },
    },
    renderedUpperWidth: item.renderedUpperWidth ? item.renderedUpperWidth * scale : item.renderedUpperWidth,
  };
  const afterBox = getFitBoxCanvasRectBeforeNormalization(nextItem);
  return offsetItem(nextItem, beforeBox.center.x - afterBox.center.x, beforeBox.center.y - afterBox.center.y);
};

const getOutfitArchetype = (items: RenderItem[]): OutfitArchetype => {
  const has = (category: VisualCategory) => items.some((item) => item.visualCategory === category);
  if (has("tops") && has("bottoms") && has("outerwear")) return "top_bottom_outerwear";
  if (has("tops") && has("bottoms")) return "top_bottom";
  if (has("dresses") && has("outerwear")) return "dress_outerwear";
  if (has("dresses")) return "dress";
  if (has("outerwear") && items.some((item) => item.metadata.bodyCoverage === "full_body")) return "full_body_outerwear";
  return "accessories_only";
};

const getLayoutTemplate = (items: RenderItem[]) => items.length ? "relationship_solver" : "empty";

const applyRelationshipAwareComposition = (items: RenderItem[]) => {
  let nextItems = [...items];
  const template = getLayoutTemplate(nextItems);
  const archetype = getOutfitArchetype(nextItems);
  const checks: RelationshipCheck[] = [];
  const warnings: string[] = [];
  const constraintsApplied: string[] = [];
  const rotationByCategory: Record<VisualCategory, number> = { outerwear: -4, dresses: 2, tops: -1, bottoms: 1, shoes: -6, hats: 5, accessories: 5 };
  const zIndexByCategory: Record<VisualCategory, number> = { outerwear: 20, dresses: 30, tops: 30, bottoms: 25, shoes: 40, hats: 40, accessories: 40 };
  const fillByCategory: Record<VisualCategory, number> = { outerwear: 0.92, dresses: 0.96, tops: 0.9, bottoms: 0.9, shoes: 0.62, hats: 0.58, accessories: 0.62 };

  if (template === "relationship_solver") {
    nextItems = nextItems.map((item, index) => {
      const rotationDeg = rotationByCategory[item.visualCategory] + (item.duplicateIndex % 2 ? 3 : 0);
      const zoneName = getAssignedZone(item.visualCategory);
      const roleLayout = roleInitialLayouts[item.visualCategory];
      const styled = {
        ...item,
        style: {
          ...item.style,
          left: `${roleLayout.x}%`,
          top: `${roleLayout.y}%`,
          zIndex: zIndexByCategory[item.visualCategory] + index,
          rotationDeg,
          transform: `translate(${item.style.offsetXPct}%, ${item.style.offsetYPct}%) rotate(${rotationDeg}deg)`,
        },
      };
      const placed = fitItemIntoZone(styled, zoneName, fillByCategory[item.visualCategory]);
      const zone = fourZoneRects[zoneName];
      const editorialNudge = item.visualCategory === "outerwear"
        ? { x: zone.width * 0.24, y: zone.height * 0.18 }
        : item.visualCategory === "dresses"
          ? { x: -zone.width * 0.18, y: zone.height * 0.02 }
          : item.visualCategory === "tops"
            ? { x: -zone.width * 0.04, y: zone.height * 0.1 }
            : item.visualCategory === "bottoms"
              ? { x: -zone.width * 0.02, y: -zone.height * 0.03 }
              : { x: zone.width * 0.04 * (index % 2 ? -1 : 1), y: zone.height * 0.06 };
      return withVisualCenter(placed, { x: zone.center.x + editorialNudge.x, y: zone.center.y + editorialNudge.y });
    });
  }

  const getFirst = (category: VisualCategory) => nextItems.find((item) => item.visualCategory === category);
  const move = (target: RenderItem | undefined, dx: number, dy: number) => {
    if (!target) return;
    nextItems = nextItems.map((item) => item === target ? offsetItem(item, dx, dy) : item);
  };
  const addCheck = (check: RelationshipCheck) => {
    checks.push({
      ...check,
      verticalOverlapGap: roundMetric(check.verticalOverlapGap),
      horizontalCenterOffset: roundMetric(check.horizontalCenterOffset),
      currentRatio: roundMetric(check.currentRatio),
      preResizeRatio: roundMetric(check.preResizeRatio),
      resizeTargetRatio: roundMetric(check.resizeTargetRatio),
      resizeScaleApplied: roundMetric(check.resizeScaleApplied),
      postResizeTopWidth: roundMetric(check.postResizeTopWidth),
      postResizeBottomWidth: roundMetric(check.postResizeBottomWidth),
      finalPostResizeRatio: roundMetric(check.finalPostResizeRatio),
    });
    if (check.warning) warnings.push(check.warning);
  };

  const top = getFirst("tops");
  const bottom = getFirst("bottoms");
  const outer = getFirst("outerwear");
  const dress = getFirst("dresses");
  const mainInner = dress || top;

  if (top && bottom) {
    constraintsApplied.push("upper_lower_stack");
    const upperBox = getFitBoxCanvasRectBeforeNormalization(top);
    const lowerBox = getFitBoxCanvasRectBeforeNormalization(bottom);
    const preResizeRatio = lowerBox.width / Math.max(upperBox.width, 1);
    const resizeTargetRatio = 0.82;
    let resizedGarment: string | null = null;
    let resizeScaleApplied: number | null = null;
    if (preResizeRatio < 0.62) {
      const scale = clamp(resizeTargetRatio / Math.max(preResizeRatio, 0.01), 1, 4.5);
      nextItems = nextItems.map((item) => {
        if (item !== bottom) return item;
        resizedGarment = item.garment?.name || item.garment?.category || "Bottom";
        resizeScaleApplied = scale;
        return scaleItemAroundFitBoxCenter(item, scale, "upper_lower_stack");
      });
    } else if (preResizeRatio > 0.96) {
      const scale = clamp(resizeTargetRatio / Math.max(preResizeRatio, 0.01), 0.55, 1);
      nextItems = nextItems.map((item) => {
        if (item !== bottom) return item;
        resizedGarment = item.garment?.name || item.garment?.category || "Bottom";
        resizeScaleApplied = scale;
        return scaleItemAroundFitBoxCenter(item, scale, "upper_lower_stack");
      });
    }
    const resizedTop = getFitBoxCanvasRectBeforeNormalization(getFirst("tops")!);
    const resizedLower = getFitBoxCanvasRectBeforeNormalization(getFirst("bottoms")!);
    const targetTop = resizedTop.bottom - Math.min(resizedTop.height * 0.12, 5);
    const targetCenterX = resizedTop.center.x;
    const dx = clamp(targetCenterX - resizedLower.center.x, -22, 22);
    const dy = clamp(targetTop - resizedLower.top, -28, 32);
    move(getFirst("bottoms"), dx, dy);
    const movedLower = getFitBoxCanvasRectBeforeNormalization(getFirst("bottoms")!);
    const chestLimit = upperBox.top + upperBox.height * 0.45;
    if (movedLower.top < chestLimit) move(getFirst("bottoms"), 0, chestLimit - movedLower.top + 1);
    const finalLower = getFitBoxCanvasRectBeforeNormalization(getFirst("bottoms")!);
    const finalTopForRatio = getFitBoxCanvasRectBeforeNormalization(getFirst("tops")!);
    const finalPostResizeRatio = finalLower.width / Math.max(finalTopForRatio.width, 1);
    addCheck({
      rule: "upper_lower_stack",
      anchorsOrBoundsUsed: `${upperBox.source} lower third ↔ ${lowerBox.source} top/waist`,
      targetRatio: "0.62–0.96",
      currentRatio: finalPostResizeRatio,
      preResizeRatio,
      resizeTargetRatio,
      resizedGarment,
      resizeScaleApplied,
      postResizeTopWidth: finalTopForRatio.width,
      postResizeBottomWidth: finalLower.width,
      finalPostResizeRatio,
      resizeHappened: resizeScaleApplied != null,
      verticalOverlapGap: finalLower.top - upperBox.bottom,
      horizontalCenterOffset: Math.abs(finalLower.center.x - finalTopForRatio.center.x),
      status: finalPostResizeRatio >= 0.62 && finalPostResizeRatio <= 0.96 && Math.abs(finalLower.center.x - finalTopForRatio.center.x) <= 12 && finalLower.top >= chestLimit ? (resizeScaleApplied != null ? "Adjusted" : "OK") : "Warning",
      warning: finalLower.top < chestLimit ? "Bottoms attempted to cover the upper garment chest/upperFit area." : undefined,
    });
  }

  if (outer && mainInner) {
    constraintsApplied.push("outerwear_frames_inner_layer");
    const outerBox = getFitBoxCanvasRectBeforeNormalization(outer);
    const innerBox = getFitBoxCanvasRectBeforeNormalization(mainInner);
    const ratio = innerBox.width / Math.max(outerBox.width, 1);
    const topBottomColumnActive = Boolean(top && bottom);
    if (!topBottomColumnActive && (ratio < 0.62 || ratio > 0.96)) {
      const scale = clamp(0.82 / Math.max(ratio, 0.01), 0.82, 1.22);
      nextItems = nextItems.map((item) => item === mainInner ? { ...item, style: { ...item.style, width: `${item.style.boxWidthPct * scale}%`, height: `${item.style.boxHeightPct * scale}%`, boxWidthPct: item.style.boxWidthPct * scale, boxHeightPct: item.style.boxHeightPct * scale, finalRenderedFitWidth: item.style.finalRenderedFitWidth ? item.style.finalRenderedFitWidth * scale : item.style.finalRenderedFitWidth, sizingDebug: { ...item.style.sizingDebug, relationshipRule: "outerwear_frames_inner_layer", relationshipScale: scale } } } : item);
    }
    const adjustedInner = getFitBoxCanvasRectBeforeNormalization(getFirst(mainInner.visualCategory)!);
    move(outer, adjustedInner.center.x - outerBox.center.x - 10, adjustedInner.center.y - outerBox.center.y + (mainInner.visualCategory === "dresses" ? 0 : 5));
    const finalOuterBox = getFitBoxCanvasRectBeforeNormalization(getFirst("outerwear")!);
    const finalOuterRatio = adjustedInner.width / Math.max(finalOuterBox.width, 1);
    addCheck({ rule: "outerwear_frames_inner_layer", anchorsOrBoundsUsed: `${outerBox.source} width ↔ ${innerBox.source} width`, targetRatio: "0.62–0.96", currentRatio: finalOuterRatio, horizontalCenterOffset: Math.abs(adjustedInner.center.x - finalOuterBox.center.x), status: finalOuterRatio >= 0.62 && finalOuterRatio <= 0.96 ? "OK" : topBottomColumnActive ? "Warning" : "Adjusted", warning: topBottomColumnActive && (finalOuterRatio < 0.62 || finalOuterRatio > 0.96) ? "Outerwear kept as frame so the connected top/bottom column ratio stays intact." : undefined });
  }

  if (dress) {
    constraintsApplied.push("full_body_main_vertical_zone");
    const dressBounds = getItemVisualBounds(dress.style, dress.garment?.image_analysis, dress.visualCategory);
    if (dressBounds.height < 45) warnings.push("Dress/full-body item rendered shorter than expected for the main vertical body zone.");
  }

  nextItems.filter((item) => ["shoes", "hats", "accessories"].includes(item.visualCategory)).forEach((accessory, index) => {
    constraintsApplied.push("accessories_lower_side_non_scaling");
    const main = dress || bottom || top || outer;
    const mainBounds = main ? getItemVisualBounds(main.style, main.garment?.image_analysis, main.visualCategory) : null;
    const target = mainBounds ? { x: mainBounds.left + mainBounds.width * (index % 2 ? 0.78 : 0.2), y: mainBounds.bottom - Math.min(8, mainBounds.height * 0.08) } : fourZoneRects.bottomLeft.center;
    move(accessory, target.x - getItemVisualBounds(accessory.style, accessory.garment?.image_analysis, accessory.visualCategory).center.x, target.y - getItemVisualBounds(accessory.style, accessory.garment?.image_analysis, accessory.visualCategory).center.y);
  });

  const finalTop = getFirst("tops");
  const finalBottom = getFirst("bottoms");
  const finalVerticalOverlapGap = finalTop && finalBottom ? getFitBoxCanvasRectBeforeNormalization(finalBottom).top - getFitBoxCanvasRectBeforeNormalization(finalTop).bottom : null;
  const finalHorizontalCenterOffset = finalTop && finalBottom ? Math.abs(getFitBoxCanvasRectBeforeNormalization(finalBottom).center.x - getFitBoxCanvasRectBeforeNormalization(finalTop).center.x) : outer && mainInner ? Math.abs(getFitBoxCanvasRectBeforeNormalization(outer).center.x - getFitBoxCanvasRectBeforeNormalization(mainInner).center.x) : null;

  const debug: RelationshipSolverDebug = {
    outfitArchetype: archetype,
    selectedRelationshipRule: constraintsApplied[0] || "accessories_only_fallback",
    constraintsApplied: Array.from(new Set(constraintsApplied)),
    relationshipChecks: checks,
    warnings,
    finalVerticalOverlapGap: roundMetric(finalVerticalOverlapGap),
    finalHorizontalCenterOffset: roundMetric(finalHorizontalCenterOffset),
    targetRatio: checks.find((check) => check.targetRatio)?.targetRatio || "relationship bounds",
    finalRatio: checks.find((check) => check.currentRatio != null)?.currentRatio ?? null,
    comparedAnchors: Object.fromEntries(checks.map((check) => [check.rule, check.anchorsOrBoundsUsed])),
    renderedAnchorLineLengths: {},
  };

  return { items: nextItems, template, debug };
};

const getCompositionMetrics = (items: RenderItem[], selectedLayoutTemplate: string): CompositionMetrics => {
  const keyFor = (item: RenderItem, index: number) => `${item.visualCategory}-${item.garment?.name || item.garment?.id || index}`;
  const entries = items.map((item, index) => ({ key: keyFor(item, index), item, bounds: getItemVisualBounds(item.style, item.garment?.image_analysis, item.visualCategory) }));
  const garmentCenters = Object.fromEntries(entries.map(({ key, bounds }) => [key, bounds.center]));
  const garmentBounds = Object.fromEntries(entries.map(({ key, bounds }) => [key, bounds]));
  const garmentZoneAssignments = entries.map(({ item, bounds }) => {
    const assignedZone = getAssignedZone(item.visualCategory);
    const zone = fourZoneRects[assignedZone];
    const overlapWidth = Math.max(0, Math.min(bounds.right, zone.right) - Math.max(bounds.left, zone.left));
    const overlapHeight = Math.max(0, Math.min(bounds.bottom, zone.bottom) - Math.max(bounds.top, zone.top));
    return {
      garmentName: item.garment?.name || item.garment?.category || item.garment?.id || "Garment",
      category: item.visualCategory,
      assignedZone,
      finalBounds: bounds,
      overlapAmount: overlapWidth * overlapHeight,
    };
  });
  const core = entries.filter(({ item }) => ["outerwear", "dresses", "tops", "bottoms"].includes(item.visualCategory));
  const pairMetrics = core.flatMap((entry, index) => core.slice(index + 1).map((other) => {
    const horizontalOverlap = Math.max(0, Math.min(entry.bounds.right, other.bounds.right) - Math.max(entry.bounds.left, other.bounds.left));
    const verticalOverlap = Math.max(0, Math.min(entry.bounds.bottom, other.bounds.bottom) - Math.max(entry.bounds.top, other.bounds.top));
    const smallerWidth = Math.max(1, Math.min(entry.bounds.width, other.bounds.width));
    const smallerHeight = Math.max(1, Math.min(entry.bounds.height, other.bounds.height));
    const dx = other.bounds.center.x - entry.bounds.center.x;
    const dy = (other.bounds.center.y - entry.bounds.center.y) / canvasAspectRatio;
    return {
      a: entry.key,
      b: other.key,
      horizontalOverlapPct: horizontalOverlap / smallerWidth,
      verticalOverlapPct: verticalOverlap / smallerHeight,
      centerDistance: Math.sqrt(dx * dx + dy * dy),
    };
  }));
  return { selectedLayoutTemplate, garmentCenters, garmentBounds, garmentZoneAssignments, pairMetrics };
};

const displayType = (category: VisualCategory) => ({ outerwear: "Outerwear", dresses: "Dress", tops: "Top", bottoms: "Bottom", shoes: "Shoes", hats: "Hat", accessories: "Accessory" }[category]);

const requiredAnchorTypes = (category: VisualCategory): FitAnchorType[] => {
  if (category === "bottoms") return ["waist", "lengthFit"];
  if (["tops", "outerwear", "dresses"].includes(category)) return ["upperFit", "lowerHemFit", "lengthFit"];
  return [];
};

const optionalAnchorTypes = (category: VisualCategory): FitAnchorType[] => {
  if (["tops", "outerwear", "dresses"].includes(category)) return ["waist"];
  if (category === "bottoms") return ["lowerHemFit"];
  return [];
};

const formatAnchorName = (anchor: FitAnchorType) => anchor === "waist" ? "waistFit" : anchor;

const getGarmentFitSummary = (item: RenderItem, relationshipDebug: RelationshipSolverDebug | ReturnType<typeof getRelationshipMetrics>) => {
  const fitBox = getPrioritizedFitBox(item.metadata, item.garment?.image_analysis);
  const rawFitBox = item.metadata.fitBox;
  const requiredFitBox = ["tops", "outerwear", "dresses", "bottoms"].includes(item.visualCategory);
  const legacyIgnored = hasActiveLegacyAnchors(item.metadata) || Boolean((item.metadata as any).legacyAnchors);
  const rendered = item.style.finalRenderedFitWidth ? { width: item.style.finalRenderedFitWidth, height: item.style.boxHeightPct * (fitBox?.height || 0) } : null;
  const relationshipScale = Number(item.style.sizingDebug?.relationshipScale || item.style.sizingDebug?.requiredDressBoxScale || 1);
  const resizeActionNeeded = Number.isFinite(relationshipScale) && Math.abs(relationshipScale - 1) > 0.02;
  const resizeReason = resizeActionNeeded
    ? item.style.sizingDebug?.relationshipRule
      ? `${displayType(item.visualCategory)} fitBox ratio was outside target for ${relationshipDebug?.selectedRelationshipRule?.replace(/_/g, " ") || "relationship rule"}.`
      : "Garment dimensions changed during fitBox relationship normalization."
    : "Within target relationship ratio.";

  return {
    name: item.garment?.name || item.garment?.category || "Garment",
    type: displayType(item.visualCategory),
    label: fitBox ? "fitBox active" : requiredFitBox ? "needs fitBox calibration" : "safe visual fallback",
    legacyLabel: legacyIgnored ? "legacy anchors ignored" : null,
    source: fitBox?.source || rawFitBox?.source || "safe visual fallback",
    confidence: Number(fitBox?.confidence ?? rawFitBox?.confidence ?? 0),
    renderedFitBoxWidth: rendered?.width ?? null,
    renderedFitBoxHeight: rendered?.height ?? null,
    status: fitBox ? (item.metadata.fitValidation?.status || "OK") : requiredFitBox ? "Needs fitBox calibration" : "OK",
    resizeActionNeeded,
    resizeReason,
  };
};

const getRelationshipStatus = (relationshipDebug: RelationshipSolverDebug | ReturnType<typeof getRelationshipMetrics>) => {
  const ratio = relationshipDebug?.finalRatio;
  const targetText = relationshipDebug?.targetRatio || "—";
  const match = targetText.match(/([0-9.]+)–([0-9.]+)/);
  const min = match ? Number(match[1]) : null;
  const max = match ? Number(match[2]) : null;
  const ok = ratio != null && min != null && max != null ? ratio >= min && ratio <= max : ratio != null;
  return ok ? "OK" : "Needs resize";
};

export const OutfitCollage = ({ garments, debugAnchors = false, debugLegacyAnchors = false }: OutfitCollageProps) => {
  const [compositionQaOpen, setCompositionQaOpen] = useState(false);
  const queryClient = useQueryClient();
  const legacyDebugEnabled = debugLegacyAnchors || new URLSearchParams(window.location.search).get("debugLegacyAnchors") === "1";

  useEffect(() => {
    const itemsToMigrate = (garments || []).filter((garment) => garment?.id && hasActiveLegacyAnchors(garment.layout_metadata || {}));
    if (!itemsToMigrate.length) return;
    let cancelled = false;
    const migrate = async () => {
      await Promise.all(itemsToMigrate.map((garment) => {
        const nextMetadata = archiveLegacyAnchorFields(garment.layout_metadata || {});
        if (!nextMetadata.fitBox) nextMetadata.fitValidation = { ...(nextMetadata.fitValidation || {}), status: "Needs fitBox calibration", rejected: ["legacy anchors archived"] };
        return supabase.from("closet_items").update({ layout_metadata: nextMetadata }).eq("id", garment.id);
      }));
      if (cancelled) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["closet"] }),
        queryClient.invalidateQueries({ queryKey: ["closet-items"] }),
        queryClient.invalidateQueries({ queryKey: ["lookbook"] }),
        queryClient.invalidateQueries({ queryKey: ["outfit-calendar-data"] }),
        queryClient.invalidateQueries({ queryKey: ["look-garments"] }),
        queryClient.invalidateQueries({ queryKey: ["saved-looks"] }),
      ]);
    };
    migrate().catch((error) => console.error("Legacy anchor migration failed", error));
    return () => { cancelled = true; };
  }, [garments, queryClient]);

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
  let renderItems: RenderItem[] = classified.map(({ garment, visualCategory, imageUrl }, stackIndex) => {
    const duplicateIndex = seenCounts[visualCategory] ?? 0;
    seenCounts[visualCategory] = duplicateIndex + 1;
    const inferred = archiveLegacyAnchorFields(inferMetadata(garment, visualCategory));
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
    const upperWidthRatio = getPrioritizedFitBox(metadata, garment?.image_analysis)?.width || null;
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
  renderItems = scaleRelationshipPrimaryToTarget(renderItems, groupNormalization);
  groupNormalization = normalizeOutfitGroup(renderItems);
  renderedSizingMetrics = getRenderedSizingMetrics(renderItems, groupNormalization);

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

  const composition = applyRelationshipAwareComposition(renderItems);
  renderItems = composition.items;
  groupNormalization = normalizeOutfitGroup(renderItems);
  renderedSizingMetrics = getRenderedSizingMetrics(renderItems, groupNormalization);
  const relationshipDebug = composition.debug;
  const compositionMetrics = getCompositionMetrics(renderItems, composition.template);
  const garmentFitSummaries = renderItems.map((item) => getGarmentFitSummary(item, relationshipDebug));
  const relationshipStatus = getRelationshipStatus(relationshipDebug);
  const relationshipRuleText = relationshipDebug?.selectedRelationshipRule?.replace(/_/g, " + ").replace("top + bottom + lowerHem + to + waist", "top + bottom").replace("outerwear + top + upperFit + to + upperFit", "outerwear + top").replace("outerwear + dress + upperFit + to + upperFit", "outerwear + dress").replace("dress + alone + upperFit + lengthFit", "dress alone") || "—";
  const comparedAnchorText = relationshipDebug?.selectedRelationshipRule === "upper_lower_stack"
    ? "upper lower third ↔ lower top/waist"
    : relationshipDebug?.selectedRelationshipRule === "outerwear_frames_inner_layer"
      ? "outerwear fitBox/bounds ↔ inner fitBox/bounds"
      : relationshipDebug?.selectedRelationshipRule === "top_bottom_fitBox_to_fitBox"
    ? "top fitBox width ↔ bottom fitBox width"
    : relationshipDebug?.selectedRelationshipRule === "outerwear_top_fitBox_to_fitBox"
      ? "top fitBox width ↔ outerwear fitBox width"
      : relationshipDebug?.selectedRelationshipRule === "outerwear_dress_fitBox_to_fitBox"
        ? "dress fitBox width ↔ outerwear fitBox width"
        : relationshipDebug?.selectedRelationshipRule === "dress_alone_fitBox"
          ? "dress fitBox width ↔ dress fitBox height"
          : "—";

  const coatFitItem = renderItems.find((item) => item.visualCategory === "outerwear");
  const dressFitItem = renderItems.find((item) => item.visualCategory === "dresses");
  const coatRenderedWidth = renderedSizingMetrics.coat?.renderedFitLineLength ?? null;
  const dressRenderedWidth = renderedSizingMetrics.dress?.renderedFitLineLength ?? null;
  const dressToCoatRatio = renderedSizingMetrics.ratio;
  const topBottomRelationshipCheck = relationshipDebug.relationshipChecks.find((check) => check.rule === "upper_lower_stack");
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
    groupOccupancyWidthPct: groupNormalization.occupancyWidthPct,
    groupOccupancyHeightPct: groupNormalization.occupancyHeightPct,
    safePaddingPct: groupNormalization.safePaddingPct,
    passFailBasis: "rendered fit line only",
    relationshipModel: relationshipDebug,
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
        const { boxWidthPct, boxHeightPct, offsetXPct, offsetYPct, anchorShiftXPct, anchorShiftYPct, rotationDeg, imageRatio, fitSource: _styleFitSource, upperFitWidthRatio, targetRenderedFitWidth, calculatedImageBoxWidth, finalRenderedFitWidth, ...imageStyle } = style;
        const fitBox = getPrioritizedFitBox(metadata, garment?.image_analysis);
        const legacyMetadata = legacyDebugEnabled ? getLegacyDebugMetadata(metadata) : metadata;
        const measurementPair = !fitBox && legacyDebugEnabled ? getRealMeasurementPair(legacyMetadata, garment?.image_analysis, visualCategory) : null;
        const measurementCenter = measurementPair ? { x: (measurementPair.left.x + measurementPair.right.x) / 2, y: (measurementPair.left.y + measurementPair.right.y) / 2 } : null;
        const landmarkPoints = legacyDebugEnabled ? [
          measurementPair?.left,
          measurementPair?.right,
          toRelativePoint(legacyMetadata.necklineCenter || legacyMetadata.bodyAnchors?.necklineCenter, garment?.image_analysis),
          toRelativePoint(legacyMetadata.waistCenter || legacyMetadata.bodyAnchors?.waistCenter, garment?.image_analysis),
          toRelativePoint(legacyMetadata.hemCenter || legacyMetadata.bodyAnchors?.hemCenter, garment?.image_analysis),
        ].filter(Boolean) : [];
        const mappedMeasurement = measurementPair
          ? { left: mapImagePointToBox(measurementPair.left, style), right: mapImagePointToBox(measurementPair.right, style) }
          : null;
        const mappedFitBox = fitBox ? {
          topLeft: mapImagePointToBox({ x: fitBox.x, y: fitBox.y }, style),
          bottomRight: mapImagePointToBox({ x: fitBox.x + fitBox.width, y: fitBox.y + fitBox.height }, style),
        } : null;
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
            {showDebugAnchors && (mappedFitBox || (legacyDebugEnabled && measurementPair && measurementCenter && mappedMeasurement)) && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {mappedFitBox && (
                  <div
                    className="absolute z-[92] border border-primary/80 bg-primary/10"
                    style={{ left: `${mappedFitBox.topLeft.x}%`, top: `${mappedFitBox.topLeft.y}%`, width: `${mappedFitBox.bottomRight.x - mappedFitBox.topLeft.x}%`, height: `${mappedFitBox.bottomRight.y - mappedFitBox.topLeft.y}%` }}
                  />
                )}
                {legacyDebugEnabled && measurementPair && mappedMeasurement && (
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
                )}
                {legacyDebugEnabled && measurementPair && mappedMeasurement && (
                  <>
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
                  </>
                )}
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
      <div className="space-y-3 rounded-xl bg-background/70 p-3 text-[11px] leading-5 text-foreground">
        <div className="space-y-3">
          <div className="font-semibold">Garment Fit Summary</div>
          {garmentFitSummaries.map((summary) => (
            <div key={summary.name} className="rounded-lg bg-secondary/20 px-2 py-2">
              <div className="font-semibold">{summary.name}</div>
              <div>{summary.label}</div>
              {summary.legacyLabel && <div>{summary.legacyLabel}</div>}
              <div>Type: {summary.type}</div>
              <div>fitBox source: {summary.source}</div>
              <div>Status: {summary.status}</div>
              <div>Confidence: {summary.confidence ? summary.confidence.toFixed(2) : "—"}</div>
              <div>Rendered fitBox width: {summary.renderedFitBoxWidth != null ? summary.renderedFitBoxWidth.toFixed(2) : "—"}</div>
              <div>Rendered fitBox height: {summary.renderedFitBoxHeight != null ? summary.renderedFitBoxHeight.toFixed(2) : "—"}</div>
              <div>Resize: {summary.resizeActionNeeded ? "Yes" : "No"}</div>
              <div>Reason: {summary.resizeReason}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-secondary/20 px-2 py-2">
          <div className="font-semibold">Relationship Check</div>
          <div>Archetype: {relationshipDebug.outfitArchetype}</div>
          <div>Rule: {relationshipRuleText}</div>
          <div>Compared: {comparedAnchorText}</div>
          <div>Target ratio: {relationshipDebug?.targetRatio || "—"}</div>
          <div>Pre-resize ratio: {topBottomRelationshipCheck?.preResizeRatio != null ? topBottomRelationshipCheck.preResizeRatio.toFixed(2) : "—"}</div>
          <div>Resize target ratio: {topBottomRelationshipCheck?.resizeTargetRatio != null ? topBottomRelationshipCheck.resizeTargetRatio.toFixed(2) : "—"}</div>
          <div>Resized garment: {topBottomRelationshipCheck?.resizedGarment || "—"}</div>
          <div>Resize scale applied: {topBottomRelationshipCheck?.resizeScaleApplied != null ? topBottomRelationshipCheck.resizeScaleApplied.toFixed(2) : "—"}</div>
          <div>Post-resize top width: {topBottomRelationshipCheck?.postResizeTopWidth != null ? topBottomRelationshipCheck.postResizeTopWidth.toFixed(2) : "—"}</div>
          <div>Post-resize bottom width: {topBottomRelationshipCheck?.postResizeBottomWidth != null ? topBottomRelationshipCheck.postResizeBottomWidth.toFixed(2) : "—"}</div>
          <div>Final post-resize ratio: {topBottomRelationshipCheck?.finalPostResizeRatio != null ? topBottomRelationshipCheck.finalPostResizeRatio.toFixed(2) : "—"}</div>
          <div>Current ratio: {relationshipDebug?.finalRatio != null ? relationshipDebug.finalRatio.toFixed(2) : "—"}</div>
          <div>Upper/lower overlap-gap: {relationshipDebug.finalVerticalOverlapGap != null ? relationshipDebug.finalVerticalOverlapGap.toFixed(2) : "—"}</div>
          <div>Center offset: {relationshipDebug.finalHorizontalCenterOffset != null ? relationshipDebug.finalHorizontalCenterOffset.toFixed(2) : "—"}</div>
          <div>Warnings: {relationshipDebug.warnings.length ? relationshipDebug.warnings.join("; ") : "None"}</div>
          <div>Status: {relationshipStatus}</div>
          <div>Resize happened: {garmentFitSummaries.some((summary) => summary.resizeActionNeeded) ? "Yes" : "No"}</div>
        </div>

        <details>
          <summary className="cursor-pointer font-medium">Advanced JSON</summary>
          <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ compositionMetrics, sizingEngineDebug, relationshipDebug }, null, 2)}</pre>
        </details>
      </div>
    )}
    </div>
  );
};

export default OutfitCollage;