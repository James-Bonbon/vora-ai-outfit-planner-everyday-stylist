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
  const left = metadata.bodyAnchors?.leftShoulder;
  const right = metadata.bodyAnchors?.rightShoulder;
  if (!left || !right) return null;
  const shoulderWidth = Math.abs(Number(right.x) - Number(left.x));
  return Number.isFinite(shoulderWidth) && shoulderWidth > 0.08 ? clamp(shoulderWidth, 0.08, 1) : null;
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
  const shoulderWidthRatio = getShoulderWidthRatio(metadata);
  const shoulderBoxWidth = shoulderWidthRatio && targetRenderedShoulderWidth
    ? targetRenderedShoulderWidth / shoulderWidthRatio
    : null;
  const boxWidth = clamp(Math.max(intendedVisibleWidth / visibleWidthRatio, shoulderBoxWidth || 0), 22, 92);
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
  };
};

export const OutfitCollage = ({ garments }: OutfitCollageProps) => {
  if (!garments || garments.length === 0) return null;

  const classified = garments
    .map((garment) => ({ garment, visualCategory: classifyGarment(garment), imageUrl: getImageUrl(garment) }))
    .filter((item) => item.imageUrl)
    .sort((a, b) => visualOrder[a.visualCategory] - visualOrder[b.visualCategory]);

  const coatHeight = classified.some((item) => item.visualCategory === "outerwear") ? 64 : undefined;

  const seenCounts: Partial<Record<VisualCategory, number>> = {};

  return (
    <div className="relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden">
      {classified.map(({ garment, visualCategory, imageUrl }, stackIndex) => {
        const duplicateIndex = seenCounts[visualCategory] ?? 0;
        seenCounts[visualCategory] = duplicateIndex + 1;

        const baseAlt = garment?.name || garment?.category || "Garment";
        const layout = stackLayouts[Math.min(stackIndex, stackLayouts.length - 1)];
        const metadata = inferMetadata(garment, visualCategory);
        const intendedVisibleHeight = getTargetVisibleHeight(visualCategory, metadata, coatHeight);
        const style = getNormalizedStyle({
          analysis: garment?.image_analysis,
          duplicateIndex,
          intendedVisibleHeight,
          layout,
          metadata,
          stackIndex,
        });

        return (
          <img
            key={`${garment?.id ?? imageUrl}-${duplicateIndex}`}
            src={imageUrl}
            alt={baseAlt}
            loading="lazy"
            decoding="async"
            className={cn("absolute object-contain object-center drop-shadow-md")}
            style={style}
          />
        );
      })}
    </div>
  );
};

export default OutfitCollage;