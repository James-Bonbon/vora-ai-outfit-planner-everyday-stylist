export type FitBoxSource = "ai" | "human" | "alpha_profile" | "ratio_guard";
export type FitBoxValidationStatus = "validated" | "estimated" | "failed" | "warning";
export type RejectionReason = "fit_box_missing" | "fit_box_not_on_garment" | "poor_alpha_coverage" | "implausible_position" | "implausible_size" | "low_confidence";

export type FitBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  source: FitBoxSource;
  confidence: number;
  validationStatus: FitBoxValidationStatus;
  notes?: string;
  rejectionReasons?: RejectionReason[];
  alphaCoverage?: number;
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
  fitBox?: FitBox | null;
  fitValidation?: { status: "OK" | "Review recommended" | "Needs calibration" | "human" | "fallback"; rejected?: string[]; invalidFitBox?: FitBox | null };
  confidence?: number;
  [key: string]: any;
};

type FitFamily = "tops" | "dresses" | "outerwear" | "bottoms" | "shoes" | "accessory";
type BoxCandidate = Omit<FitBox, "validationStatus">;
const activeLegacyAnchorFields = ["leftUpperAnchor", "rightUpperAnchor", "upperBodyWidthAnchor", "leftWaistAnchor", "rightWaistAnchor", "validatedMeasurementAnchors", "measurementAnchors", "layoutAnchors"] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

export const classifyFitFamily = (category?: string | null, name?: string | null, garmentType?: string | null): FitFamily => {
  const text = `${garmentType ?? ""} ${category ?? ""} ${name ?? ""}`.toLowerCase();
  if (/shoe|sneaker|boot|heel|loafer|sandal|trainer/.test(text)) return "shoes";
  if (/dress|gown|jumpsuit|romper|one[-\s]?piece/.test(text)) return "dresses";
  if (/outerwear|coat|jacket|blazer|trench|parka|cardigan/.test(text)) return "outerwear";
  if (/trouser|pant|jean|legging|chino|skirt|short(?![-\s]?sleeve)/.test(text)) return "bottoms";
  if (/top|shirt|blouse|tee|t-shirt|knit|sweater|jumper|hoodie/.test(text)) return "tops";
  return "accessory";
};

export const requiresFitBox = (family: string) => ["tops", "dresses", "outerwear", "bottoms"].includes(family);

const getBounds = (analysis?: ImageAnalysisForFit | null) => analysis?.visibleAlphaBounds || (analysis?.visibleX != null && analysis?.visibleY != null && analysis?.visibleWidth && analysis?.visibleHeight ? { x: analysis.visibleX, y: analysis.visibleY, width: analysis.visibleWidth, height: analysis.visibleHeight } : null);

const normalizeScalar = (value: any, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * max : n;
};

const normalizeBox = (box: any, analysis?: ImageAnalysisForFit | null, source: FitBoxSource = "ai", confidence = 0.5, notes?: string): BoxCandidate | null => {
  if (!box || !analysis?.imageWidth || !analysis?.imageHeight) return null;
  const x = normalizeScalar(box.x, analysis.imageWidth);
  const y = normalizeScalar(box.y, analysis.imageHeight);
  const width = normalizeScalar(box.width, analysis.imageWidth);
  const height = normalizeScalar(box.height, analysis.imageHeight);
  if ([x, y, width, height].some((value) => value == null) || !width || !height) return null;
  return {
    x: round(clamp(x!, 0, analysis.imageWidth)),
    y: round(clamp(y!, 0, analysis.imageHeight)),
    width: round(clamp(width, 1, analysis.imageWidth - clamp(x!, 0, analysis.imageWidth))),
    height: round(clamp(height, 1, analysis.imageHeight - clamp(y!, 0, analysis.imageHeight))),
    source: (box.source || source) as FitBoxSource,
    confidence: clamp(Number(box.confidence ?? confidence), 0, 1),
    notes: box.notes || notes,
    alphaCoverage: Number(box.alphaCoverage) || undefined,
  };
};

const maskHit = (analysis: ImageAnalysisForFit | null | undefined, x: number, y: number) => {
  if (!analysis?.imageWidth || !analysis?.imageHeight) return false;
  const mask = analysis.alphaMask;
  if (mask?.width && mask?.height && mask.data) {
    const mx = clamp(Math.round((x / analysis.imageWidth) * (mask.width - 1)), 0, mask.width - 1);
    const my = clamp(Math.round((y / analysis.imageHeight) * (mask.height - 1)), 0, mask.height - 1);
    const value = typeof mask.data === "string" ? mask.data[my * mask.width + mx] : mask.data[my * mask.width + mx];
    return value === "1" || value === 1 || value === true;
  }
  const row = Math.round(y);
  const extent = analysis.alphaRowExtents?.[row];
  return Boolean(extent && x >= extent.left && x <= extent.right);
};

const fitBoxAlphaCoverage = (box: BoxCandidate, analysis?: ImageAnalysisForFit | null) => {
  if (!analysis?.imageWidth || !analysis.imageHeight) return 0;
  const cols = 9;
  const rows = 13;
  let hits = 0;
  let total = 0;
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = box.x + (box.width * (ix + 0.5)) / cols;
      const y = box.y + (box.height * (iy + 0.5)) / rows;
      total += 1;
      if (maskHit(analysis, x, y)) hits += 1;
    }
  }
  return total ? hits / total : 0;
};

const validateFitBox = (box: BoxCandidate | null, analysis: ImageAnalysisForFit | null | undefined, family: FitFamily): FitBox => {
  const fallback = box || { x: 0, y: 0, width: 0, height: 0, source: "ratio_guard" as FitBoxSource, confidence: 0, notes: "Missing fitBox." };
  const reasons: RejectionReason[] = [];
  if (!box) reasons.push("fit_box_missing");
  if (box && analysis?.imageWidth && analysis?.imageHeight) {
    const b = getBounds(analysis);
    const widthRatio = box.width / analysis.imageWidth;
    const heightRatio = box.height / analysis.imageHeight;
    const topWithinVisible = b ? box.y >= b.y - b.height * 0.06 && box.y <= b.y + b.height * (family === "bottoms" ? 0.28 : 0.42) : true;
    const overlapsVisible = b ? Math.max(0, Math.min(box.x + box.width, b.x + b.width) - Math.max(box.x, b.x)) * Math.max(0, Math.min(box.y + box.height, b.y + b.height) - Math.max(box.y, b.y)) > 0 : true;
    const coverage = fitBoxAlphaCoverage(box, analysis);
    const minWidth = family === "bottoms" ? 0.12 : 0.16;
    const maxWidth = family === "outerwear" ? 0.9 : 0.82;
    if (!overlapsVisible) reasons.push("fit_box_not_on_garment");
    if (coverage < 0.08) reasons.push("poor_alpha_coverage");
    if (!topWithinVisible) reasons.push("implausible_position");
    if (widthRatio < minWidth || widthRatio > maxWidth || heightRatio < 0.18 || heightRatio > 1) reasons.push("implausible_size");
    if (box.source !== "human" && box.confidence < 0.5) reasons.push("low_confidence");
    return {
      ...box,
      alphaCoverage: round(coverage),
      validationStatus: reasons.length ? (box.source === "human" ? "warning" : "failed") : box.source === "ai" || box.source === "human" ? "validated" : "estimated",
      rejectionReasons: Array.from(new Set(reasons)),
      notes: reasons.length && box.source === "human" ? `Human fitBox kept; warning: ${reasons.join(", ")}.` : box.notes,
    };
  }
  return { ...fallback, validationStatus: fallback.source === "human" ? "warning" : "failed", rejectionReasons: reasons };
};

const rowCandidate = (analysis: ImageAnalysisForFit, startPct: number, endPct: number) => {
  const b = getBounds(analysis);
  if (!b) return null;
  const start = Math.max(0, Math.floor(b.y + b.height * startPct));
  const end = Math.min((analysis.imageHeight || 1) - 1, Math.ceil(b.y + b.height * endPct));
  let best: { y: number; left: number; right: number; width: number; score: number } | null = null;
  for (let y = start; y <= end; y++) {
    const extent = analysis.alphaRowExtents?.[y];
    const width = extent ? extent.right - extent.left + 1 : Number(analysis.alphaProfileRows?.[y]) || 0;
    if (!extent || width < b.width * 0.18) continue;
    const targetY = start + (end - start) * 0.45;
    const yPenalty = 1 - Math.min(0.5, Math.abs(y - targetY) / Math.max(end - start, 1));
    const score = width * yPenalty;
    if (!best || score > best.score) best = { y, left: extent.left, right: extent.right, width, score };
  }
  return best;
};

const buildAlphaFitBox = (analysis: ImageAnalysisForFit | null | undefined, family: FitFamily): BoxCandidate | null => {
  const b = getBounds(analysis);
  if (!analysis?.imageWidth || !analysis?.imageHeight || !b || !requiresFitBox(family)) return null;
  const topBand = family === "bottoms" ? rowCandidate(analysis, 0.02, 0.2) : rowCandidate(analysis, 0.1, 0.35);
  const topY = topBand?.y ?? (b.y + b.height * (family === "bottoms" ? 0.06 : 0.16));
  const rawWidth = topBand?.width ?? b.width * (family === "outerwear" ? 0.62 : family === "bottoms" ? 0.55 : 0.5);
  const centerX = topBand ? (topBand.left + topBand.right) / 2 : b.x + b.width / 2;
  const width = clamp(rawWidth, analysis.imageWidth * (family === "bottoms" ? 0.16 : 0.22), b.width);
  const x = clamp(centerX - width / 2, b.x, b.x + b.width - width);
  const height = clamp(b.y + b.height - topY, analysis.imageHeight * 0.18, analysis.imageHeight - topY);
  const candidate: BoxCandidate = { x, y: topY, width, height, source: "alpha_profile", confidence: topBand ? 0.72 : 0.54, notes: "Estimated fitBox from visible garment alpha profile." };
  const coverage = fitBoxAlphaCoverage(candidate, analysis);
  return { ...candidate, confidence: clamp(candidate.confidence * (0.65 + Math.min(0.35, coverage)), 0.3, 0.85) };
};

const legacyAnchorFitBox = (metadata: any, analysis: ImageAnalysisForFit | null | undefined, family: FitFamily, source: FitBoxSource, confidence: number): BoxCandidate | null => {
  if (!analysis?.imageWidth || !analysis?.imageHeight || !requiresFitBox(family)) return null;
  const left = family === "bottoms" ? metadata?.leftWaistAnchor : (metadata?.leftUpperFitAnchor || metadata?.leftUpperAnchor);
  const right = family === "bottoms" ? metadata?.rightWaistAnchor : (metadata?.rightUpperFitAnchor || metadata?.rightUpperAnchor);
  const lx = normalizeScalar(left?.x, analysis.imageWidth);
  const ly = normalizeScalar(left?.y, analysis.imageHeight);
  const rx = normalizeScalar(right?.x, analysis.imageWidth);
  const ry = normalizeScalar(right?.y, analysis.imageHeight);
  if ([lx, ly, rx, ry].some((value) => value == null)) return null;
  const b = getBounds(analysis);
  const y = Math.min(ly!, ry!);
  const width = Math.abs(rx! - lx!);
  const x = Math.min(lx!, rx!);
  const hemY = normalizeScalar(metadata?.bottomLengthFitAnchor?.y ?? metadata?.hemCenter?.y ?? metadata?.hemLeft?.y ?? metadata?.leftHem?.y, analysis.imageHeight);
  const bottom = hemY || (b ? b.y + b.height : analysis.imageHeight);
  return { x, y, width, height: Math.max(1, bottom - y), source, confidence, notes: "Converted from legacy fit anchors." };
};

const archiveLegacyAnchors = (metadata: any) => {
  const archived: Record<string, any> = { ...(metadata?.legacyAnchors || {}) };
  activeLegacyAnchorFields.forEach((field) => {
    if (metadata?.[field] != null) archived[field] = metadata[field];
  });
  return Object.keys(archived).length ? archived : undefined;
};

const omitActiveLegacyAnchors = (metadata: any) => {
  const next = { ...(metadata || {}) };
  activeLegacyAnchorFields.forEach((field) => delete next[field]);
  return next;
};

const calibrationStatus = (family: FitFamily, box: FitBox | null) => {
  if (!requiresFitBox(family)) return "OK" as const;
  if (!box || box.validationStatus === "failed" || box.confidence < 0.5) return "Needs calibration" as const;
  if (box.validationStatus === "warning" || box.confidence < 0.7) return "Review recommended" as const;
  return "OK" as const;
};

export const buildGarmentFitMetadata = ({ metadata, analysis, category, name }: { metadata: any; analysis?: ImageAnalysisForFit | null; category?: string | null; name?: string | null }): FitMetadata => {
  const rawAiLandmarks = metadata?.rawAiLandmarks || metadata || {};
  const family = classifyFitFamily(category, name, rawAiLandmarks.garmentType || metadata?.garmentType);
  const baseConfidence = clamp(Number(rawAiLandmarks.confidence ?? metadata?.confidence ?? 0.55), 0, 1);
  const existingFitBox = normalizeBox(metadata?.fitBox, analysis, metadata?.fitBox?.source || "ai", Number(metadata?.fitBox?.confidence ?? baseConfidence), metadata?.fitBox?.notes);
  const humanFitBox = existingFitBox?.source === "human" ? existingFitBox : null;
  const aiFitBox = !humanFitBox && (normalizeBox(rawAiLandmarks.fitBox, analysis, "ai", baseConfidence, rawAiLandmarks.notes) || legacyAnchorFitBox(rawAiLandmarks, analysis, family, "ai", baseConfidence));
  const alphaFitBox = !humanFitBox && !aiFitBox ? buildAlphaFitBox(analysis, family) : null;
  const ratioGuard = !humanFitBox && !aiFitBox && !alphaFitBox && requiresFitBox(family) && analysis?.imageWidth && getBounds(analysis)
    ? (() => {
        const b = getBounds(analysis)!;
        const y = b.y + b.height * (family === "bottoms" ? 0.08 : 0.16);
        const width = b.width * (family === "outerwear" ? 0.58 : family === "bottoms" ? 0.5 : 0.48);
        return { x: b.x + (b.width - width) / 2, y, width, height: b.y + b.height - y, source: "ratio_guard" as FitBoxSource, confidence: 0.42, notes: "Low-confidence ratio guard estimate; calibrate before sizing." };
      })()
    : null;

  const selected = humanFitBox || aiFitBox || alphaFitBox || ratioGuard;
  const fitBox = requiresFitBox(family) ? validateFitBox(selected, analysis, family) : null;
  const invalidFitBox = fitBox?.validationStatus === "failed" ? fitBox : null;
  const status = calibrationStatus(family, fitBox);
  const legacyAnchors = archiveLegacyAnchors(metadata);

  return {
    ...omitActiveLegacyAnchors(metadata),
    rawAiLandmarks,
    ...(legacyAnchors ? { legacyAnchors } : {}),
    fitBox,
    confidence: fitBox?.confidence ?? baseConfidence,
    fitValidation: {
      status,
      rejected: fitBox?.rejectionReasons?.map((reason) => `fitBox:${reason}`) || [],
      invalidFitBox,
    },
  };
};
