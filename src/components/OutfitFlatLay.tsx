import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils";

interface Garment {
  id: string;
  name: string | null;
  image_url: string;
}

interface OutfitFlatLayProps {
  garments: Garment[];
  onTryOnMake: () => void;
  isLoading?: boolean;
  className?: string;
}

export const OutfitFlatLay: React.FC<OutfitFlatLayProps> = ({
  garments,
  onTryOnMake,
  isLoading,
  className,
}) => {
  if (!garments || garments.length === 0) return null;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* The Flat-Lay Canvas */}
      <div className="w-full rounded-2xl bg-flatlay p-5 shadow-[0_4px_24px_-4px_hsl(var(--flatlay-bg)/0.5)]">
        <div
          className={cn(
            "grid gap-3",
            garments.length === 1 && "grid-cols-1 max-w-[180px] mx-auto",
            garments.length === 2 && "grid-cols-2 max-w-[320px] mx-auto",
            garments.length === 3 && "grid-cols-2",
            garments.length >= 4 && "grid-cols-2",
          )}
        >
          {garments.map((garment, index) => (
            <div
              key={garment.id}
              className={cn(
                "aspect-[3/4] rounded-xl overflow-hidden flex items-center justify-center p-3 bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10",
                garments.length === 3 && index === 0 && "col-span-2 aspect-[4/3]",
              )}
            >
              <SafeImage
                src={garment.image_url}
                alt={garment.name || "Garment"}
                aspectRatio=""
                fit="contain"
                className="mix-blend-multiply dark:mix-blend-normal drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]"
                wrapperClassName="w-full h-full"
              />
            </div>
          ))}
        </div>
      </div>

      {/* The VTON Trigger Button */}
      <Button
        onClick={onTryOnMake}
        disabled={isLoading}
        className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md h-11 text-sm font-semibold gap-2"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? "Generating Magic…" : "See it on me"}
      </Button>
    </div>
  );
};

export default OutfitFlatLay;
