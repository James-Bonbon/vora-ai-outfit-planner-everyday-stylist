export type AnchorSource = "ai" | "human" | "alpha_profile" | "alpha_estimate" | "ratio_guard";

export type FitPoint = {
  x: number;
  y: number;
  source: AnchorSource;
  confidence: number;
  notes?: string;
};

export type FitAnchorGroup = Record<string, FitPoint | number | string | undefined> & {
  source?: AnchorSource;
  confidence?: number;
  notes?: string;
  validationStatus?: "validated" | "estimated" | "failed";
  failureReason?: string;
};

export type ImageAnalysisForFit = {
  imageWidth?: number;
  imageHeight?: number;
  visibleX?: number;
  visibleY?: number;
  visibleWidth?: number;
  visibleHeight?: number;
  visibleAlphaBounds?: { x: number; y: number; width: number; height: number };
  alphaProfileRows?: number[];
  alphaProfileColumns?: number[];
  alphaRowExtents?: Array<{ left: number; right: number } | null>;
};

export type FitMetadata = {
  garmentType?: string;
  bodyCoverage?: string;
  rawAiLandmarks?: any;
  validatedMeasurementAnchors?: {
    upperFit?: FitAnchorGroup;
    waist?: FitAnchorGroup;
    lowerHemFit?: FitAnchorGroup;
    hipFit?: FitAnchorGroup;
    lengthFit?: FitAnchorGroup;
    length?: FitAnchorGroup;
    shoe?: FitAnchorGroup;
  };
  measurementAnchors?: FitMetadata["validatedMeasurementAnchors"];
  layoutAnchors?: {
    upperFit?: FitAnchorGroup;
    waist?: FitAnchorGroup;
    lowerHemFit?: FitAnchorGroup;
    hipFit?: FitAnchorGroup;
    lengthFit?: FitAnchorGroup;
    length?: FitAnchorGroup;
    shoe?: FitAnchorGroup;
  };
  fitValidation?: { status: "ai" | "human" | "fallback" | "mixed"; rejected?: string[]; renderedRatios?: Record<string, number | null> };
  confidence?: number;
  [key: string]: any;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const classifyFitFamily = (category?: string | null, name?: string | null, garmentType?: string | null) => {
  const text = `${garmentType ?? ""} ${category ?? ""} ${name ?? ""}`.toLowerCase();
  if (/shoe|sneaker|boot|heel|loafer|sandal|trainer/.test(text)) return "shoes";
  if (/trouser|pant|jean|legging|chino|skirt|short/.test(text)) return "bottoms";
  if (/dress|gown|jumpsuit|romper|one[-\s]?piece/.test(text)) return "dresses";
  if (/outerwear|coat|jacket|blazer|trench|parka|cardigan/.test(text)) return "outerwear";
  if (/top|shirt|blouse|tee|t-shirt|knit|sweater|jumper|hoodie/.test(text)) return "tops";
  return "accessory";
};

export const normalizeFitPoint = (point: any, analysis?: ImageAnalysisForFit | null, source: AnchorSource = "ai", confidence = 0.5, notes?: string): FitPoint | undefined => {
  if (!point || !analysis?.imageWidth || !analysis?.imageHeight) return undefined;
  const rawX = Number(Array.isArray(point) ? point[0] : point.x);
  const rawY = Number(Array.isArray(point) ? point[1] : point.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return undefined;
  return {
    x: clamp(rawX <= 1 ? rawX * analysis.imageWidth : rawX, 0, analysis.imageWidth),
    y: clamp(rawY <= 1 ? rawY * analysis.imageHeight : rawY, 0, analysis.imageHeight),
    source,
    confidence: clamp(confidence, 0, 1),
    notes,
  };
};

const withinVisibleBounds = (point: FitPoint | undefined, analysis?: ImageAnalysisForFit | null, tolerance = 6) => {
  if (!point || !analysis?.visibleAlphaBounds) return false;
  const b = analysis.visibleAlphaBounds;
  return point.x >= b.x - tolerance && point.x <= b.x + b.width + tolerance && point.y >= b.y - tolerance && point.y <= b.y + b.height + tolerance;
};

const pointPair = (left: FitPoint | undefined, right: FitPoint | undefined) => left && right ? Math.abs(right.x - left.x) : 0;

const withPointMeta = (point: FitPoint, source: AnchorSource, confidence: number, notes?: string): FitPoint => ({ ...point, source, confidence, notes: notes || point.notes });

const scanAlphaBand = (analysis: ImageAnalysisForFit | null | undefined, startPct: number, endPct: number, preferredWidthRatio: [number, number], mode: "upper" | "waist" | "hem") => {
  if (!analysis?.imageWidth || !analysis?.imageHeight || !analysis.visibleAlphaBounds || !analysis.alphaProfileRows?.length) return null;
  const b = analysis.visibleAlphaBounds;
  const startY = Math.max(b.y, Math.floor(b.y + b.height * startPct));
  const endY = Math.min(b.y + b.height - 1, Math.ceil(b.y + b.height * endPct));
  const rows = [] as Array<{ y: number; left: number; right: number; width: number; score: number }>;
  const rowExtents = analysis.alphaRowExtents;
  const maxWidth = Math.max(...analysis.alphaProfileRows.slice(b.y, b.y + b.height), 1);
  const medianTarget = analysis.imageWidth * ((preferredWidthRatio[0] + preferredWidthRatio[1]) / 2);
  for (let y = startY; y <= endY; y++) {
    const width = Number(analysis.alphaProfileRows[y]) || 0;
    if (width < analysis.imageWidth * preferredWidthRatio[0] || width > analysis.imageWidth * preferredWidthRatio[1]) continue;
    const extent = rowExtents?.[y] || { left: b.x + (b.width - width) / 2, right: b.x + (b.width + width) / 2 };
    const sleevePenalty = mode === "upper" && width > maxWidth * 0.86 ? 0.78 : 1;
    const targetPenalty = 1 - Math.min(0.55, Math.abs(width - medianTarget) / Math.max(medianTarget, 1));
    const bandCenter = startY + (endY - startY) / 2;
    const centerPenalty = 1 - Math.min(0.35, Math.abs(y - bandCenter) / Math.max(endY - startY, 1));
    rows.push({ y, left: extent.left, right: extent.right, width, score: sleevePenalty * targetPenalty * centerPenalty });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows[0] || null;
};

const buildAlphaProfileAnchors = (analysis: ImageAnalysisForFit | null | undefined, family: string) => {
  const isUpper = ["tops", "outerwear", "dresses"].includes(family);
  const isBottoms = family === "bottoms";
  if (!isUpper && !isBottoms) return null;
  const confidence = 0.42;
  const notes = "Estimated from alpha profile scan; not an AI measurement.";
  const upperBounds: [number, number] = family === "outerwear" ? [0.34, 0.78] : family === "dresses" ? [0.32, 0.72] : [0.24, 0.68];
  const result: FitMetadata["layoutAnchors"] = {};
  const upper = isUpper ? scanAlphaBand(analysis, 0.1, 0.35, upperBounds, "upper") : null;
  const waist = scanAlphaBand(analysis, isBottoms ? 0.02 : 0.38, isBottoms ? 0.18 : 0.62, [0.18, 0.72], "waist");
  const hem = scanAlphaBand(analysis, isBottoms ? 0.68 : 0.78, 0.96, [0.12, 0.82], "hem");
  if (upper) result!.upperFit = { leftUpperFitAnchor: { x: upper.left, y: upper.y, source: "alpha_profile", confidence, notes }, rightUpperFitAnchor: { x: upper.right, y: upper.y, source: "alpha_profile", confidence, notes }, upperBodyFitWidth: upper.width, source: "alpha_profile", confidence, validationStatus: "estimated", notes };
  if (waist) result!.waist = { leftWaistAnchor: { x: waist.left, y: waist.y, source: "alpha_profile", confidence, notes }, rightWaistAnchor: { x: waist.right, y: waist.y, source: "alpha_profile", confidence, notes }, waistFitWidth: waist.width, source: "alpha_profile", confidence, validationStatus: "estimated", notes };
  if (hem) result!.lowerHemFit = { leftLowerHemFitAnchor: { x: hem.left, y: hem.y, source: "alpha_profile", confidence, notes }, rightLowerHemFitAnchor: { x: hem.right, y: hem.y, source: "alpha_profile", confidence, notes }, lowerHemFitWidth: hem.width, source: "alpha_profile", confidence, validationStatus: "estimated", notes };
  if (analysis?.visibleAlphaBounds) {
    const b = analysis.visibleAlphaBounds;
    result!.lengthFit = { topLengthFitAnchor: { x: b.x + b.width / 2, y: b.y, source: "alpha_profile", confidence, notes }, bottomLengthFitAnchor: { x: b.x + b.width / 2, y: b.y + b.height, source: "alpha_profile", confidence, notes }, lengthFitHeight: b.height, source: "alpha_profile", confidence, validationStatus: "estimated", notes };
  }
  return Object.keys(result || {}).length ? result : null;
};

export const buildGarmentFitMetadata = ({
  metadata,
  analysis,
  category,
  name,
}: {
  metadata: any;
  analysis?: ImageAnalysisForFit | null;
  category?: string | null;
  name?: string | null;
}): FitMetadata => {
  const rawAiLandmarks = metadata?.rawAiLandmarks || metadata || {};
  const family = classifyFitFamily(category, name, rawAiLandmarks.garmentType || metadata?.garmentType);
  const confidence = clamp(Number(rawAiLandmarks.confidence ?? metadata?.confidence ?? 0), 0, 1);
  const rejected: string[] = [];
  const next: FitMetadata = { ...(metadata || {}), rawAiLandmarks, validatedMeasurementAnchors: {}, layoutAnchors: {}, fitValidation: { status: "fallback", rejected } };

  const upperLeft = normalizeFitPoint(rawAiLandmarks.leftUpperFitAnchor || rawAiLandmarks.leftUpperAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const upperRight = normalizeFitPoint(rawAiLandmarks.rightUpperFitAnchor || rawAiLandmarks.rightUpperAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const waistLeft = normalizeFitPoint(rawAiLandmarks.leftWaistAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const waistRight = normalizeFitPoint(rawAiLandmarks.rightWaistAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const hemLeft = normalizeFitPoint(rawAiLandmarks.leftLowerHemFitAnchor || rawAiLandmarks.leftHemAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const hemRight = normalizeFitPoint(rawAiLandmarks.rightLowerHemFitAnchor || rawAiLandmarks.rightHemAnchor, analysis, "ai", confidence, rawAiLandmarks.notes);
  const lengthTop = normalizeFitPoint(rawAiLandmarks.topLengthFitAnchor || rawAiLandmarks.necklineCenter, analysis, "ai", confidence, rawAiLandmarks.notes);
  const lengthBottom = normalizeFitPoint(rawAiLandmarks.bottomLengthFitAnchor || rawAiLandmarks.hemCenter, analysis, "ai", confidence, rawAiLandmarks.notes);
  const upperWidth = Number(rawAiLandmarks.upperBodyFitWidth) > 0 ? Number(rawAiLandmarks.upperBodyFitWidth) : pointPair(upperLeft, upperRight);
  const waistWidth = Number(rawAiLandmarks.waistFitWidth) > 0 ? Number(rawAiLandmarks.waistFitWidth) : pointPair(waistLeft, waistRight);
  const lowerHemWidth = Number(rawAiLandmarks.lowerHemFitWidth || rawAiLandmarks.hemFitWidth) > 0 ? Number(rawAiLandmarks.lowerHemFitWidth || rawAiLandmarks.hemFitWidth) : pointPair(hemLeft, hemRight);
  const lengthHeight = Number(rawAiLandmarks.lengthFitHeight) > 0 ? Number(rawAiLandmarks.lengthFitHeight) : lengthTop && lengthBottom ? Math.abs(lengthBottom.y - lengthTop.y) : 0;
  const imageWidth = Number(analysis?.imageWidth) || 1;
  const imageHeight = Number(analysis?.imageHeight) || 1;
  const upperRatio = upperWidth / imageWidth;
  const waistRatio = waistWidth / imageWidth;
  const lowerHemRatio = lowerHemWidth / imageWidth;
  const lengthRatio = lengthHeight / imageHeight;
  const upperBounds = family === "outerwear" ? [0.34, 0.78] : family === "dresses" ? [0.32, 0.72] : [0.24, 0.68];

  const humanUpper = metadata?.validatedMeasurementAnchors?.upperFit?.source === "human" ? metadata.validatedMeasurementAnchors.upperFit : null;
  const humanWaist = metadata?.validatedMeasurementAnchors?.waist?.source === "human" ? metadata.validatedMeasurementAnchors.waist : null;
  const humanHem = metadata?.validatedMeasurementAnchors?.lowerHemFit?.source === "human" ? metadata.validatedMeasurementAnchors.lowerHemFit : null;
  const humanLength = metadata?.validatedMeasurementAnchors?.lengthFit?.source === "human" ? metadata.validatedMeasurementAnchors.lengthFit : null;
  if (humanUpper) next.validatedMeasurementAnchors!.upperFit = humanUpper;
  if (humanWaist) next.validatedMeasurementAnchors!.waist = humanWaist;
  if (humanHem) next.validatedMeasurementAnchors!.lowerHemFit = humanHem;
  if (humanLength) next.validatedMeasurementAnchors!.lengthFit = humanLength;

  if (!humanUpper && ["tops", "outerwear", "dresses"].includes(family)) {
    if (!upperLeft || !upperRight) rejected.push("missing_upper_fit_anchors");
    if (confidence < 0.5) rejected.push("low_upper_fit_confidence");
    if (upperRatio < upperBounds[0] || upperRatio > upperBounds[1]) rejected.push("implausible_upper_fit_width");
    if (!withinVisibleBounds(upperLeft, analysis) || !withinVisibleBounds(upperRight, analysis)) rejected.push("upper_fit_outside_visible_alpha_bounds");
    if (upperLeft && upperRight && confidence >= 0.5 && upperRatio >= upperBounds[0] && upperRatio <= upperBounds[1] && withinVisibleBounds(upperLeft, analysis) && withinVisibleBounds(upperRight, analysis)) {
      next.validatedMeasurementAnchors!.upperFit = {
        leftUpperFitAnchor: withPointMeta(upperLeft, "ai", confidence),
        rightUpperFitAnchor: withPointMeta(upperRight, "ai", confidence),
        upperBodyFitWidth: upperWidth,
        source: "ai",
        confidence,
        validationStatus: "validated",
        notes: rawAiLandmarks.notes || "Accepted AI upper-body fit width.",
      };
    }
  }

  if (!humanWaist && ["bottoms", "dresses", "tops", "outerwear"].includes(family)) {
    if (waistLeft && waistRight && confidence >= 0.5 && waistRatio >= 0.18 && waistRatio <= 0.72 && withinVisibleBounds(waistLeft, analysis) && withinVisibleBounds(waistRight, analysis)) {
      next.validatedMeasurementAnchors!.waist = {
        leftWaistAnchor: withPointMeta(waistLeft, "ai", confidence),
        rightWaistAnchor: withPointMeta(waistRight, "ai", confidence),
        waistFitWidth: waistWidth,
        source: "ai",
        confidence,
        validationStatus: "validated",
        notes: rawAiLandmarks.notes || "Accepted AI waist fit width.",
      };
    } else if (family === "bottoms") {
      rejected.push("missing_or_implausible_waist_fit_anchors");
    }
  }

  if (!humanHem && ["tops", "outerwear", "dresses", "bottoms"].includes(family)) {
    if (hemLeft && hemRight && confidence >= 0.5 && lowerHemRatio >= 0.12 && lowerHemRatio <= 0.9 && withinVisibleBounds(hemLeft, analysis) && withinVisibleBounds(hemRight, analysis)) {
      next.validatedMeasurementAnchors!.lowerHemFit = {
        leftLowerHemFitAnchor: withPointMeta(hemLeft, "ai", confidence),
        rightLowerHemFitAnchor: withPointMeta(hemRight, "ai", confidence),
        lowerHemFitWidth: lowerHemWidth,
        source: "ai",
        confidence,
        validationStatus: "validated",
        notes: rawAiLandmarks.notes || "Accepted AI lower hem fit width.",
      };
    } else rejected.push("missing_or_implausible_lower_hem_fit_anchors");
  }

  if (!humanLength && ["outerwear", "dresses", "bottoms"].includes(family)) {
    if (lengthTop && lengthBottom && confidence >= 0.5 && lengthRatio >= 0.25 && lengthRatio <= 1 && withinVisibleBounds(lengthTop, analysis) && withinVisibleBounds(lengthBottom, analysis)) {
      next.validatedMeasurementAnchors!.lengthFit = {
        topLengthFitAnchor: withPointMeta(lengthTop, "ai", confidence),
        bottomLengthFitAnchor: withPointMeta(lengthBottom, "ai", confidence),
        lengthFitHeight: lengthHeight,
        source: "ai",
        confidence,
        validationStatus: "validated",
        notes: rawAiLandmarks.notes || "Accepted AI garment length fit.",
      };
    } else rejected.push("missing_or_implausible_length_fit_anchors");
  }

  const alphaLayout = buildAlphaProfileAnchors(analysis, family);
  if (!next.validatedMeasurementAnchors!.upperFit && alphaLayout?.upperFit) next.layoutAnchors!.upperFit = alphaLayout.upperFit;
  if (!next.validatedMeasurementAnchors!.waist && alphaLayout?.waist) next.layoutAnchors!.waist = alphaLayout.waist;
  if (!next.validatedMeasurementAnchors!.lowerHemFit && alphaLayout?.lowerHemFit) next.layoutAnchors!.lowerHemFit = alphaLayout.lowerHemFit;
  if (!next.validatedMeasurementAnchors!.lengthFit && alphaLayout?.lengthFit) next.layoutAnchors!.lengthFit = alphaLayout.lengthFit;

  if (!next.validatedMeasurementAnchors!.upperFit && !next.layoutAnchors!.upperFit && ["tops", "outerwear", "dresses"].includes(family) && analysis?.imageWidth && analysis?.imageHeight && analysis.visibleAlphaBounds) {
    const minRatio = family === "outerwear" || family === "dresses" ? 0.44 : 0.32;
    const b = analysis.visibleAlphaBounds;
    const targetWidth = clamp(Math.max(upperWidth || 0, analysis.imageWidth * minRatio), analysis.imageWidth * minRatio, b.width);
    const centerX = upperLeft && upperRight ? (upperLeft.x + upperRight.x) / 2 : b.x + b.width / 2;
    const y = upperLeft && upperRight ? (upperLeft.y + upperRight.y) / 2 : b.y + b.height * (family === "outerwear" ? 0.16 : 0.13);
    const source: AnchorSource = upperWidth > 0 ? "ratio_guard" : "alpha_estimate";
    const fallbackConfidence = source === "ratio_guard" ? 0.49 : 0.35;
    next.layoutAnchors!.upperFit = {
      leftUpperFitAnchor: { x: clamp(centerX - targetWidth / 2, 0, analysis.imageWidth), y: clamp(y, 0, analysis.imageHeight), source, confidence: fallbackConfidence, notes: "Estimated layout anchor; not a measurement." },
      rightUpperFitAnchor: { x: clamp(centerX + targetWidth / 2, 0, analysis.imageWidth), y: clamp(y, 0, analysis.imageHeight), source, confidence: fallbackConfidence, notes: "Estimated layout anchor; not a measurement." },
      upperBodyFitWidth: targetWidth,
      source,
      confidence: fallbackConfidence,
      notes: source === "ratio_guard" ? "Ratio guard expanded an implausible AI upper-fit span for layout only." : "Alpha bounds estimated upper-fit span for layout only.",
    };
  }

  next.measurementAnchors = next.validatedMeasurementAnchors;
  next.leftUpperAnchor = next.layoutAnchors?.upperFit?.leftUpperFitAnchor || next.validatedMeasurementAnchors?.upperFit?.leftUpperFitAnchor;
  next.rightUpperAnchor = next.layoutAnchors?.upperFit?.rightUpperFitAnchor || next.validatedMeasurementAnchors?.upperFit?.rightUpperFitAnchor;
  next.upperBodyWidthAnchor = next.layoutAnchors?.upperFit?.upperBodyFitWidth || next.validatedMeasurementAnchors?.upperFit?.upperBodyFitWidth;
  next.confidence = Number(next.validatedMeasurementAnchors?.upperFit?.confidence ?? next.validatedMeasurementAnchors?.waist?.confidence ?? next.layoutAnchors?.upperFit?.confidence ?? confidence);
  next.fitValidation!.status = Object.values(next.validatedMeasurementAnchors || {}).some((g: any) => g?.source === "human") ? "human" : Object.keys(next.validatedMeasurementAnchors || {}).length ? "ai" : "fallback";
  return next;
};