export type AnchorSource = "ai" | "human" | "alpha_profile" | "alpha_estimate" | "ratio_guard";
export type RejectionReason = "anchor_point_not_on_garment" | "line_crosses_empty_space" | "implausible_y_position" | "width_out_of_range" | "optional_anchor_not_confident" | "missing_required_anchor";

export type FitPoint = {
  x: number;
  y: number;
  source: AnchorSource;
  confidence: number;
  notes?: string;
  warningReason?: RejectionReason;
};

export type FitAnchorGroup = Record<string, FitPoint | number | string | string[] | undefined> & {
  source?: AnchorSource;
  confidence?: number;
  notes?: string;
  validationStatus?: "validated" | "estimated" | "failed" | "warning";
  failureReason?: string;
  rejectionReasons?: RejectionReason[];
  usedForSizing?: boolean;
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
  alphaMask?: { width: number; height: number; threshold?: number; data: string | number[] | boolean[] };
};

export type FitMetadata = {
  garmentType?: string;
  bodyCoverage?: string;
  rawAiLandmarks?: any;
  validatedMeasurementAnchors?: Partial<Record<"upperFit" | "waist" | "lowerHemFit" | "hipFit" | "lengthFit" | "length" | "shoe", FitAnchorGroup>>;
  measurementAnchors?: FitMetadata["validatedMeasurementAnchors"];
  layoutAnchors?: FitMetadata["validatedMeasurementAnchors"];
  invalidAnchors?: Array<{ anchor: string; source?: string; reasons: RejectionReason[]; confidence?: number }>;
  fitValidation?: { status: "OK" | "Review recommended" | "Needs calibration" | "ai" | "human" | "fallback" | "mixed"; rejected?: string[]; invalidAnchors?: FitMetadata["invalidAnchors"]; renderedRatios?: Record<string, number | null> };
  confidence?: number;
  [key: string]: any;
};

type FitFamily = "tops" | "dresses" | "outerwear" | "bottoms" | "shoes" | "accessory";
type AnchorType = "upperFit" | "waist" | "lowerHemFit" | "lengthFit";

type ValidationResult = { valid: boolean; reasons: RejectionReason[]; lineCoverage: number; confidence: number };

type CandidateRow = { y: number; left: number; right: number; width: number; score: number; confidence: number; lineCoverage: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const classifyFitFamily = (category?: string | null, name?: string | null, garmentType?: string | null): FitFamily => {
  const text = `${garmentType ?? ""} ${category ?? ""} ${name ?? ""}`.toLowerCase();
  if (/shoe|sneaker|boot|heel|loafer|sandal|trainer/.test(text)) return "shoes";
  if (/dress|gown|jumpsuit|romper|one[-\s]?piece/.test(text)) return "dresses";
  if (/outerwear|coat|jacket|blazer|trench|parka|cardigan/.test(text)) return "outerwear";
  if (/trouser|pant|jean|legging|chino|skirt|short(?![-\s]?sleeve)/.test(text)) return "bottoms";
  if (/top|shirt|blouse|tee|t-shirt|knit|sweater|jumper|hoodie/.test(text)) return "tops";
  return "accessory";
};

export const requiredFitAnchorsForFamily = (family: string): AnchorType[] => {
  if (["tops", "dresses", "outerwear"].includes(family)) return ["upperFit", "lowerHemFit", "lengthFit"];
  if (family === "bottoms") return ["waist", "lengthFit"];
  return [];
};

const optionalFitAnchorsForFamily = (family: string): AnchorType[] => {
  if (["tops", "dresses", "outerwear"].includes(family)) return ["waist"];
  if (family === "bottoms") return ["lowerHemFit"];
  return [];
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

const pointPair = (left: FitPoint | undefined, right: FitPoint | undefined, type: AnchorType = "upperFit") => {
  if (!left || !right) return 0;
  return type === "lengthFit" ? Math.abs(right.y - left.y) : Math.abs(right.x - left.x);
};

const getBounds = (analysis?: ImageAnalysisForFit | null) => analysis?.visibleAlphaBounds || (analysis?.visibleX != null && analysis?.visibleY != null && analysis?.visibleWidth && analysis?.visibleHeight ? { x: analysis.visibleX, y: analysis.visibleY, width: analysis.visibleWidth, height: analysis.visibleHeight } : null);

const withinVisibleBounds = (point: FitPoint | undefined, analysis?: ImageAnalysisForFit | null, tolerance = 4) => {
  if (!point) return false;
  const b = getBounds(analysis);
  if (!b) return true;
  return point.x >= b.x - tolerance && point.x <= b.x + b.width + tolerance && point.y >= b.y - tolerance && point.y <= b.y + b.height + tolerance;
};

const maskHit = (analysis: ImageAnalysisForFit | null | undefined, x: number, y: number, radiusPx = 10) => {
  if (!analysis?.imageWidth || !analysis?.imageHeight) return withinVisibleBounds({ x, y, source: "ai", confidence: 1 }, analysis, radiusPx);
  const mask = analysis.alphaMask;
  if (mask?.width && mask?.height && mask.data) {
    const mx = clamp(Math.round((x / analysis.imageWidth) * (mask.width - 1)), 0, mask.width - 1);
    const my = clamp(Math.round((y / analysis.imageHeight) * (mask.height - 1)), 0, mask.height - 1);
    const rx = Math.max(1, Math.ceil((radiusPx / analysis.imageWidth) * mask.width));
    const ry = Math.max(1, Math.ceil((radiusPx / analysis.imageHeight) * mask.height));
    for (let yy = my - ry; yy <= my + ry; yy++) {
      for (let xx = mx - rx; xx <= mx + rx; xx++) {
        if (xx < 0 || yy < 0 || xx >= mask.width || yy >= mask.height) continue;
        const value = typeof mask.data === "string" ? mask.data[yy * mask.width + xx] : mask.data[yy * mask.width + xx];
        if (value === "1" || value === 1 || value === true) return true;
      }
    }
    return false;
  }
  const row = Math.round(y);
  const extent = analysis.alphaRowExtents?.[row];
  return Boolean(extent && x >= extent.left - radiusPx && x <= extent.right + radiusPx && withinVisibleBounds({ x, y, source: "ai", confidence: 1 }, analysis, radiusPx));
};

const lineCoverage = (left: FitPoint, right: FitPoint, analysis?: ImageAnalysisForFit | null) => {
  const samples = 24;
  let hits = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = left.x + (right.x - left.x) * t;
    const y = left.y + (right.y - left.y) * t;
    if (maskHit(analysis, x, y, 8)) hits += 1;
  }
  return hits / (samples + 1);
};

const widthBounds = (family: string, type: AnchorType): [number, number] => {
  if (type === "lengthFit") return [0.25, 1];
  if (type === "upperFit") return family === "outerwear" ? [0.34, 0.78] : family === "dresses" ? [0.30, 0.72] : [0.22, 0.68];
  if (type === "waist") return [0.16, 0.72];
  return [0.12, family === "bottoms" ? 0.78 : 0.9];
};

const yBounds = (family: string, type: AnchorType): [number, number] => {
  if (type === "upperFit") return [0.04, 0.38];
  if (type === "waist") return family === "bottoms" ? [0, 0.24] : [0.30, 0.68];
  if (type === "lowerHemFit") return family === "bottoms" ? [0.58, 1] : [0.60, 1];
  return [0, 1];
};

const validatePair = (left: FitPoint | undefined, right: FitPoint | undefined, analysis: ImageAnalysisForFit | null | undefined, family: string, type: AnchorType, confidence: number, optional = false): ValidationResult => {
  const reasons: RejectionReason[] = [];
  if (!left || !right) reasons.push(optional ? "optional_anchor_not_confident" : "missing_required_anchor");
  if (!left || !right || !analysis?.imageWidth || !analysis?.imageHeight) return { valid: false, reasons, lineCoverage: 0, confidence: 0 };
  const ratio = pointPair(left, right, type) / (type === "lengthFit" ? analysis.imageHeight : analysis.imageWidth);
  const [minWidth, maxWidth] = widthBounds(family, type);
  const b = getBounds(analysis);
  const yRatio = b ? ((((left.y + right.y) / 2) - b.y) / Math.max(b.height, 1)) : ((left.y + right.y) / 2) / analysis.imageHeight;
  const [minY, maxY] = yBounds(family, type);
  if (!withinVisibleBounds(left, analysis) || !withinVisibleBounds(right, analysis) || !maskHit(analysis, left.x, left.y) || !maskHit(analysis, right.x, right.y)) reasons.push("anchor_point_not_on_garment");
  const coverage = lineCoverage(left, right, analysis);
  if (type !== "lengthFit" && coverage < 0.42) reasons.push("line_crosses_empty_space");
  if (ratio < minWidth || ratio > maxWidth) reasons.push("width_out_of_range");
  if (yRatio < minY || yRatio > maxY) reasons.push("implausible_y_position");
  if (optional && confidence < 0.7) reasons.push("optional_anchor_not_confident");
  return { valid: reasons.length === 0, reasons: Array.from(new Set(reasons)), lineCoverage: coverage, confidence: clamp(confidence, 0, 1) };
};

const groupKeys: Record<AnchorType, [string, string, string]> = {
  upperFit: ["leftUpperFitAnchor", "rightUpperFitAnchor", "upperBodyFitWidth"],
  waist: ["leftWaistAnchor", "rightWaistAnchor", "waistFitWidth"],
  lowerHemFit: ["leftLowerHemFitAnchor", "rightLowerHemFitAnchor", "lowerHemFitWidth"],
  lengthFit: ["topLengthFitAnchor", "bottomLengthFitAnchor", "lengthFitHeight"],
};

const makeGroup = (type: AnchorType, left: FitPoint, right: FitPoint, source: AnchorSource, confidence: number, notes: string, validationStatus: FitAnchorGroup["validationStatus"] = "validated", extra?: Partial<FitAnchorGroup>): FitAnchorGroup => {
  const [leftKey, rightKey, widthKey] = groupKeys[type];
  return {
    [leftKey]: { ...left, source, confidence, notes },
    [rightKey]: { ...right, source, confidence, notes },
    [widthKey]: pointPair(left, right, type),
    source,
    confidence: clamp(confidence, 0, 1),
    validationStatus,
    notes,
    usedForSizing: validationStatus === "validated" && source !== "ratio_guard" && confidence >= 0.5,
    ...extra,
  };
};

const pushInvalid = (invalid: FitMetadata["invalidAnchors"], anchor: AnchorType, source: string | undefined, result: ValidationResult, confidence?: number) => {
  if (!result.reasons.length) return;
  invalid?.push({ anchor, source, reasons: result.reasons, confidence });
};

const preserveHumanGroup = (group: FitAnchorGroup | undefined, type: AnchorType, analysis: ImageAnalysisForFit | null | undefined, family: string): FitAnchorGroup | undefined => {
  if (!group || group.source !== "human") return undefined;
  const [leftKey, rightKey] = groupKeys[type];
  const left = normalizeFitPoint(group[leftKey], analysis, "human", 1, "Human calibrated anchor.");
  const right = normalizeFitPoint(group[rightKey], analysis, "human", 1, "Human calibrated anchor.");
  if (!left || !right) return group;
  const warning = validatePair(left, right, analysis, family, type, 1, false);
  return makeGroup(type, left, right, "human", 1, warning.reasons.length ? `Human anchor kept as source of truth; warning: ${warning.reasons.join(", ")}.` : "Human-approved fit anchor.", warning.reasons.length ? "warning" : "validated", { rejectionReasons: warning.reasons, usedForSizing: true });
};

const alphaConfidence = (candidate: CandidateRow, analysis: ImageAnalysisForFit, family: string, type: AnchorType) => {
  const b = getBounds(analysis);
  const rowCount = analysis.alphaProfileRows?.[candidate.y] || 0;
  const visibleWidth = Math.max(b?.width || analysis.imageWidth || 1, 1);
  const rowDensity = clamp(rowCount / visibleWidth, 0, 1);
  const nearby = [-3, -2, -1, 1, 2, 3].map((offset) => analysis.alphaRowExtents?.[candidate.y + offset]).filter(Boolean) as Array<{ left: number; right: number }>;
  const stability = nearby.length ? 1 - clamp(nearby.reduce((sum, extent) => sum + Math.abs(extent.left - candidate.left) + Math.abs(extent.right - candidate.right), 0) / (nearby.length * Math.max(candidate.width, 1) * 2), 0, 1) : 0.4;
  const [minWidth, maxWidth] = widthBounds(family, type);
  const ratio = candidate.width / Math.max(analysis.imageWidth || 1, 1);
  const widthScore = ratio >= minWidth && ratio <= maxWidth ? 1 : 0.25;
  const coverageScore = clamp(candidate.lineCoverage, 0, 1);
  const confidence = 0.24 + rowDensity * 0.16 + stability * 0.2 + coverageScore * 0.26 + widthScore * 0.12;
  return clamp(confidence, 0.3, 0.85);
};

const scanAlphaBand = (analysis: ImageAnalysisForFit | null | undefined, family: string, type: AnchorType, startPct: number, endPct: number, preferredWidthRatio: [number, number]) => {
  if (!analysis?.imageWidth || !analysis?.imageHeight || !getBounds(analysis) || !analysis.alphaProfileRows?.length) return null;
  const b = getBounds(analysis)!;
  const startY = Math.max(b.y, Math.floor(b.y + b.height * startPct));
  const endY = Math.min(b.y + b.height - 1, Math.ceil(b.y + b.height * endPct));
  const rows: CandidateRow[] = [];
  const maxWidth = Math.max(...analysis.alphaProfileRows.slice(b.y, b.y + b.height), 1);
  const medianTarget = analysis.imageWidth * ((preferredWidthRatio[0] + preferredWidthRatio[1]) / 2);
  for (let y = startY; y <= endY; y++) {
    const width = Number(analysis.alphaProfileRows[y]) || 0;
    if (width < analysis.imageWidth * preferredWidthRatio[0] || width > analysis.imageWidth * preferredWidthRatio[1]) continue;
    const extent = analysis.alphaRowExtents?.[y] || { left: b.x + (b.width - width) / 2, right: b.x + (b.width + width) / 2 };
    const left = { x: extent.left, y, source: "alpha_profile" as AnchorSource, confidence: 0.5 };
    const right = { x: extent.right, y, source: "alpha_profile" as AnchorSource, confidence: 0.5 };
    const coverage = lineCoverage(left, right, analysis);
    const sleevePenalty = type === "upperFit" && width > maxWidth * 0.9 ? 0.72 : 1;
    const targetPenalty = 1 - Math.min(0.55, Math.abs(width - medianTarget) / Math.max(medianTarget, 1));
    const bandCenter = startY + (endY - startY) / 2;
    const centerPenalty = 1 - Math.min(0.35, Math.abs(y - bandCenter) / Math.max(endY - startY, 1));
    const candidate = { y, left: extent.left, right: extent.right, width, score: sleevePenalty * targetPenalty * centerPenalty * Math.max(coverage, 0.2), confidence: 0.5, lineCoverage: coverage };
    candidate.confidence = alphaConfidence(candidate, analysis, family, type);
    rows.push(candidate);
  }
  rows.sort((a, b) => b.score - a.score);
  return rows[0] || null;
};

const buildAlphaProfileAnchors = (analysis: ImageAnalysisForFit | null | undefined, family: FitFamily) => {
  const result: FitMetadata["layoutAnchors"] = {};
  if (!["tops", "outerwear", "dresses", "bottoms"].includes(family) || !analysis?.visibleAlphaBounds) return null;
  const upperBounds: [number, number] = family === "outerwear" ? [0.34, 0.78] : family === "dresses" ? [0.3, 0.72] : [0.22, 0.68];
  const addAlphaPair = (type: AnchorType, candidate: CandidateRow | null, optional = false) => {
    if (!candidate) return;
    const left = { x: candidate.left, y: candidate.y, source: "alpha_profile" as AnchorSource, confidence: candidate.confidence };
    const right = { x: candidate.right, y: candidate.y, source: "alpha_profile" as AnchorSource, confidence: candidate.confidence };
    const validation = validatePair(left, right, analysis, family, type, candidate.confidence, optional);
    if (!validation.valid || candidate.confidence < (optional ? 0.7 : 0.3)) return;
    result![type === "waist" ? "waist" : type] = makeGroup(type, left, right, "alpha_profile", candidate.confidence, `Estimated from alpha profile (${candidate.confidence >= 0.7 ? "high" : candidate.confidence >= 0.5 ? "medium" : "weak"} signal).`, "estimated", { lineCoverage: candidate.lineCoverage as any });
  };
  if (["tops", "outerwear", "dresses"].includes(family)) addAlphaPair("upperFit", scanAlphaBand(analysis, family, "upperFit", 0.1, 0.35, upperBounds));
  if (family === "bottoms") addAlphaPair("waist", scanAlphaBand(analysis, family, "waist", 0.02, 0.18, [0.16, 0.72]));
  if (["tops", "outerwear", "dresses"].includes(family)) addAlphaPair("waist", scanAlphaBand(analysis, family, "waist", 0.38, 0.62, [0.16, 0.72]), true);
  addAlphaPair("lowerHemFit", scanAlphaBand(analysis, family, "lowerHemFit", family === "bottoms" ? 0.68 : 0.74, 0.96, [0.12, 0.82]), family === "bottoms");
  const b = analysis.visibleAlphaBounds;
  const top = { x: b.x + b.width / 2, y: b.y, source: "alpha_profile" as AnchorSource, confidence: 0.7 };
  const bottom = { x: b.x + b.width / 2, y: b.y + b.height, source: "alpha_profile" as AnchorSource, confidence: 0.7 };
  const lengthConfidence = clamp(0.52 + Math.min(0.25, b.height / Math.max(analysis.imageHeight || 1, 1) * 0.25), 0.5, 0.82);
  result!.lengthFit = makeGroup("lengthFit", top, bottom, "alpha_profile", lengthConfidence, "Estimated visible garment length from alpha bounds.", "estimated");
  return Object.keys(result || {}).length ? result : null;
};

const sourceConfidence = (group?: FitAnchorGroup) => Number(group?.confidence ?? 0);

const calibrationStatus = (family: FitFamily, anchors: FitMetadata["validatedMeasurementAnchors"], layout: FitMetadata["layoutAnchors"]) => {
  const required = requiredFitAnchorsForFamily(family);
  if (!required.length) return "OK" as const;
  const confidences = required.map((type) => Math.max(sourceConfidence(anchors?.[type]), sourceConfidence(layout?.[type])));
  if (confidences.some((value) => value < 0.5)) return "Needs calibration" as const;
  if (confidences.some((value) => value < 0.7)) return "Review recommended" as const;
  return "OK" as const;
};

export const buildGarmentFitMetadata = ({ metadata, analysis, category, name }: { metadata: any; analysis?: ImageAnalysisForFit | null; category?: string | null; name?: string | null }): FitMetadata => {
  const rawAiLandmarks = metadata?.rawAiLandmarks || metadata || {};
  const family = classifyFitFamily(category, name, rawAiLandmarks.garmentType || metadata?.garmentType);
  const confidence = clamp(Number(rawAiLandmarks.confidence ?? metadata?.confidence ?? 0), 0, 1);
  const invalidAnchors: FitMetadata["invalidAnchors"] = [];
  const rejected: string[] = [];
  const next: FitMetadata = { ...(metadata || {}), rawAiLandmarks, validatedMeasurementAnchors: {}, layoutAnchors: {}, invalidAnchors, fitValidation: { status: "Needs calibration", rejected, invalidAnchors } };

  const existing = metadata?.validatedMeasurementAnchors || metadata?.measurementAnchors || {};
  for (const type of ["upperFit", "waist", "lowerHemFit", "lengthFit"] as AnchorType[]) {
    const human = preserveHumanGroup(existing?.[type], type, analysis, family);
    if (human) next.validatedMeasurementAnchors![type] = human;
  }

  const candidates: Record<AnchorType, [FitPoint | undefined, FitPoint | undefined, number]> = {
    upperFit: [normalizeFitPoint(rawAiLandmarks.leftUpperFitAnchor || rawAiLandmarks.leftUpperAnchor, analysis, "ai", confidence, rawAiLandmarks.notes), normalizeFitPoint(rawAiLandmarks.rightUpperFitAnchor || rawAiLandmarks.rightUpperAnchor, analysis, "ai", confidence, rawAiLandmarks.notes), Number(rawAiLandmarks.upperBodyFitWidth) || 0],
    waist: [normalizeFitPoint(rawAiLandmarks.leftWaistAnchor, analysis, "ai", confidence, rawAiLandmarks.notes), normalizeFitPoint(rawAiLandmarks.rightWaistAnchor, analysis, "ai", confidence, rawAiLandmarks.notes), Number(rawAiLandmarks.waistFitWidth) || 0],
    lowerHemFit: [normalizeFitPoint(rawAiLandmarks.leftLowerHemFitAnchor || rawAiLandmarks.leftHemAnchor || rawAiLandmarks.hemLeft, analysis, "ai", confidence, rawAiLandmarks.notes), normalizeFitPoint(rawAiLandmarks.rightLowerHemFitAnchor || rawAiLandmarks.rightHemAnchor || rawAiLandmarks.hemRight, analysis, "ai", confidence, rawAiLandmarks.notes), Number(rawAiLandmarks.lowerHemFitWidth || rawAiLandmarks.hemFitWidth) || 0],
    lengthFit: [normalizeFitPoint(rawAiLandmarks.topLengthFitAnchor || rawAiLandmarks.necklineCenter, analysis, "ai", confidence, rawAiLandmarks.notes), normalizeFitPoint(rawAiLandmarks.bottomLengthFitAnchor || rawAiLandmarks.hemCenter, analysis, "ai", confidence, rawAiLandmarks.notes), Number(rawAiLandmarks.lengthFitHeight || rawAiLandmarks.garmentLength || rawAiLandmarks.legLength) || 0],
  };

  const required = requiredFitAnchorsForFamily(family);
  const optional = optionalFitAnchorsForFamily(family);
  for (const type of [...required, ...optional]) {
    if (next.validatedMeasurementAnchors?.[type]) continue;
    const [left, right] = candidates[type];
    const isOptional = optional.includes(type);
    const validation = validatePair(left, right, analysis, family, type, confidence, isOptional);
    if (validation.valid && confidence >= (isOptional ? 0.7 : 0.5)) {
      next.validatedMeasurementAnchors![type] = makeGroup(type, left!, right!, "ai", confidence, rawAiLandmarks.notes || `Accepted AI ${type} anchors.`);
    } else {
      pushInvalid(invalidAnchors, type, "ai", validation, confidence);
      validation.reasons.forEach((reason) => rejected.push(`${type}:${reason}`));
    }
  }

  const alphaLayout = buildAlphaProfileAnchors(analysis, family);
  for (const type of required) {
    if (!next.validatedMeasurementAnchors?.[type] && alphaLayout?.[type]) next.layoutAnchors![type] = alphaLayout[type];
    if (!next.validatedMeasurementAnchors?.[type] && !next.layoutAnchors?.[type]) rejected.push(`${type}:missing_required_anchor`);
  }
  for (const type of optional) {
    if (!next.validatedMeasurementAnchors?.[type] && alphaLayout?.[type] && Number(alphaLayout[type]?.confidence) >= 0.7) next.layoutAnchors![type] = alphaLayout[type];
  }

  if (!next.validatedMeasurementAnchors!.upperFit && !next.layoutAnchors!.upperFit && ["tops", "outerwear", "dresses"].includes(family) && analysis?.imageWidth && analysis?.visibleAlphaBounds) {
    const b = analysis.visibleAlphaBounds;
    const minRatio = family === "outerwear" || family === "dresses" ? 0.44 : 0.32;
    const targetWidth = clamp(analysis.imageWidth * minRatio, 1, b.width);
    const centerX = b.x + b.width / 2;
    const y = b.y + b.height * (family === "outerwear" ? 0.16 : 0.13);
    const left = { x: clamp(centerX - targetWidth / 2, b.x, b.x + b.width), y, source: "ratio_guard" as AnchorSource, confidence: 0.45 };
    const right = { x: clamp(centerX + targetWidth / 2, b.x, b.x + b.width), y, source: "ratio_guard" as AnchorSource, confidence: 0.45 };
    next.layoutAnchors!.upperFit = makeGroup("upperFit", left, right, "ratio_guard", 0.45, "Ratio guard layout-only fallback; not used for relationship sizing.", "estimated", { usedForSizing: false });
  }

  next.measurementAnchors = next.validatedMeasurementAnchors;
  const displayUpper = next.validatedMeasurementAnchors?.upperFit || next.layoutAnchors?.upperFit;
  next.leftUpperAnchor = displayUpper?.leftUpperFitAnchor;
  next.rightUpperAnchor = displayUpper?.rightUpperFitAnchor;
  next.upperBodyWidthAnchor = displayUpper?.upperBodyFitWidth;
  const status = calibrationStatus(family, next.validatedMeasurementAnchors, next.layoutAnchors);
  next.confidence = Math.max(...required.map((type) => Math.max(sourceConfidence(next.validatedMeasurementAnchors?.[type]), sourceConfidence(next.layoutAnchors?.[type]))), confidence, 0);
  next.fitValidation = { status, rejected: Array.from(new Set(rejected)), invalidAnchors };
  return next;
};
