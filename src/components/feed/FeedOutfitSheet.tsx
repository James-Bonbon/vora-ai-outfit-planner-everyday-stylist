import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, Share2, Sparkles } from "lucide-react";
import type { FeedItem } from "./DiscoverFeed";

interface FeedOutfitSheetProps {
  item: FeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedOutfitSheet = ({ item, open, onOpenChange }: FeedOutfitSheetProps) => {
  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-outfit text-lg">{item.title}</SheetTitle>
          <p className="text-[11px] text-muted-foreground font-semibold tracking-wide">
            {item.username} · {item.curator}
          </p>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Outfit Breakdown
          </p>

          {item.garments.map((garment, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
            >
              {/* Placeholder swatch */}
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {garment.category.slice(0, 3).toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{garment.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {garment.brand} · {garment.category}
                </p>
              </div>
            </div>
          ))}

          {/* Action button placeholders */}
          <div className="flex gap-2 pt-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              <Heart className="w-4 h-4" />
              Wishlist
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
              <Sparkles className="w-4 h-4" />
              Ask AI
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
