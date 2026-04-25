import type { CSSProperties } from "react";
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
  if (/\b(dress|gown|jumpsuit|romper|one[-\s]?piece)\b/.test(text)) return "dresses";
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

export const OutfitCollage = ({ garments }: OutfitCollageProps) => {
  if (!garments || garments.length === 0) return null;

  const classified = garments
    .map((garment) => ({ garment, visualCategory: classifyGarment(garment), imageUrl: getImageUrl(garment) }))
    .filter((item) => item.imageUrl);

  const hasTop = classified.some((item) => item.visualCategory === "tops");
  const hasOuterwear = classified.some((item) => item.visualCategory === "outerwear");
  const hasDress = classified.some((item) => item.visualCategory === "dresses");
  const seenCounts: Partial<Record<VisualCategory, number>> = {};

  return (
    <div className="relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden flex items-center justify-center">
      {classified.map(({ garment, visualCategory, imageUrl }) => {
        const duplicateIndex = seenCounts[visualCategory] ?? 0;
        seenCounts[visualCategory] = duplicateIndex + 1;

        const baseAlt = garment?.name || garment?.category || "Garment";
        const centered = visualCategory !== "accessories";
        const style = centered ? centeredStyle(duplicateIndex) : accessoryStyle(duplicateIndex);

        if (visualCategory === "outerwear" && hasDress) {
          const leftPanelClassName =
            "absolute top-[8%] left-1/2 -translate-x-1/2 w-[82%] h-[62%] object-contain drop-shadow-lg z-40 [clip-path:polygon(0_0,42%_0,42%_100%,0_100%)]";
          const rightPanelClassName =
            "absolute top-[8%] left-1/2 -translate-x-1/2 w-[82%] h-[62%] object-contain drop-shadow-lg z-40 [clip-path:polygon(58%_0,100%_0,100%_100%,58%_100%)]";

          return (
            <>
              <img
                key={`${garment?.id ?? imageUrl}-${duplicateIndex}-left-panel`}
                src={imageUrl}
                alt={baseAlt}
                loading="lazy"
                decoding="async"
                className={leftPanelClassName}
                style={style}
              />
              <img
                key={`${garment?.id ?? imageUrl}-${duplicateIndex}-right-panel`}
                src={imageUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className={rightPanelClassName}
                style={style}
              />
            </>
          );
        }

        const className = cn(
          visualCategory === "shoes" &&
            "absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[40%] h-[20%] object-contain drop-shadow-md z-10",
          visualCategory === "bottoms" &&
            "absolute top-[40%] left-1/2 -translate-x-1/2 w-[65%] h-[55%] object-contain object-top drop-shadow-md z-20",
          visualCategory === "dresses" &&
            cn(
              "absolute left-1/2 -translate-x-1/2 object-contain drop-shadow-md z-30",
              hasOuterwear ? "top-[12%] w-[72%] h-[72%]" : "top-[10%] w-[70%] h-[75%]",
            ),
          visualCategory === "tops" &&
            cn(
              "absolute top-[10%] left-1/2 -translate-x-1/2 w-[75%] h-[45%] object-contain drop-shadow-md z-30",
              hasOuterwear && "[clip-path:polygon(40%_0,100%_0,100%_100%,40%_100%)] pl-2",
            ),
          visualCategory === "outerwear" &&
            cn(
              "absolute top-[8%] left-1/2 -translate-x-1/2 w-[75%] h-[55%] object-contain drop-shadow-lg z-40",
              hasTop && "[clip-path:polygon(0_0,55%_0,55%_100%,0_100%)] pr-2",
            ),
          visualCategory === "hats" &&
            "absolute top-[2%] left-1/2 -translate-x-1/2 w-[40%] h-[20%] object-contain drop-shadow-md z-50",
          visualCategory === "accessories" &&
            "absolute top-[40%] right-[5%] w-[35%] h-[35%] object-contain drop-shadow-xl z-50",
        );

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