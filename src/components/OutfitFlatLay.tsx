import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";
import { cn } from "@/lib/utils";

interface Garment {
  id: string;
  name: string | null;
  image_url: string;
  category?: string | null;
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
        <OutfitCollage garments={garments} />
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
