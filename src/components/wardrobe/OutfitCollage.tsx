import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type OutfitCollageProps = {
  garments: any[];
};

type VisualCategory = "shoes" | "bottoms" | "tops" | "outerwear" | "dresses" | "hats" | "accessories";

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

const centeredStyle = (index: number): CSSProperties => {
  const offset = centeredOffsets[index % centeredOffsets.length];
  return {
    transform: `translateX(calc(-50% + ${offset.x}px)) translateY(${offset.y}px)`,
  };
};

const accessoryStyle = (index: number): CSSProperties => {
  if (index % 3 === 1) return { top: "46%", right: "auto", left: "5%", transform: "translate(12px, 12px)" };
  if (index % 3 === 2) return { top: "34%", right: "12%", transform: "translate(-10px, 18px)" };
  return {};
};

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
  {
    className: "absolute top-[8%] left-[18%] w-[58%] h-[58%] object-contain object-center drop-shadow-md z-10",
    rotate: -5,
  },
  {
    className: "absolute top-[18%] left-[30%] w-[56%] h-[56%] object-contain object-center drop-shadow-md z-20",
    rotate: 3,
  },
  {
    className: "absolute top-[28%] left-[42%] w-[50%] h-[50%] object-contain object-center drop-shadow-md z-30",
    rotate: -2,
  },
  {
    className: "absolute top-[42%] left-[20%] w-[52%] h-[48%] object-contain object-center drop-shadow-md z-40",
    rotate: 4,
  },
  {
    className: "absolute top-[56%] left-[48%] w-[34%] h-[28%] object-contain object-center drop-shadow-md z-50",
    rotate: -7,
  },
  {
    className: "absolute top-[58%] left-[8%] w-[36%] h-[30%] object-contain object-center drop-shadow-md z-60",
    rotate: 6,
  },
];

const categoryClassName: Partial<Record<VisualCategory, string>> = {
  outerwear: "w-[64%] h-[62%]",
  dresses: "w-[60%] h-[68%]",
  tops: "w-[52%] h-[48%]",
  bottoms: "w-[50%] h-[58%]",
  shoes: "w-[34%] h-[28%]",
  hats: "w-[30%] h-[24%]",
  accessories: "w-[32%] h-[30%]",
};

const stackStyle = (stackIndex: number, duplicateIndex: number, rotate: number): CSSProperties => {
  const offset = centeredOffsets[duplicateIndex % centeredOffsets.length];
  const overflowOffset = Math.max(0, stackIndex - stackLayouts.length + 1) * 10;
  return {
    transform: `translate(${offset.x + overflowOffset}px, ${offset.y + overflowOffset}px) rotate(${rotate}deg)`,
  };
};

export const OutfitCollage = ({ garments }: OutfitCollageProps) => {
  if (!garments || garments.length === 0) return null;

  const classified = garments
    .map((garment) => ({ garment, visualCategory: classifyGarment(garment), imageUrl: getImageUrl(garment) }))
    .filter((item) => item.imageUrl)
    .sort((a, b) => visualOrder[a.visualCategory] - visualOrder[b.visualCategory]);

  const seenCounts: Partial<Record<VisualCategory, number>> = {};

  return (
    <div className="relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden">
      {classified.map(({ garment, visualCategory, imageUrl }, stackIndex) => {
        const duplicateIndex = seenCounts[visualCategory] ?? 0;
        seenCounts[visualCategory] = duplicateIndex + 1;

        const baseAlt = garment?.name || garment?.category || "Garment";
        const layout = stackLayouts[Math.min(stackIndex, stackLayouts.length - 1)];
        const className = cn(layout.className, categoryClassName[visualCategory]);
        const style = stackStyle(stackIndex, duplicateIndex, layout.rotate);

        return (
          <img
            key={`${garment?.id ?? imageUrl}-${duplicateIndex}`}
            src={imageUrl}
            alt={baseAlt}
            loading="lazy"
            decoding="async"
            className={className}
            style={style}
          />
        );
      })}
    </div>
  );
};

export default OutfitCollage;