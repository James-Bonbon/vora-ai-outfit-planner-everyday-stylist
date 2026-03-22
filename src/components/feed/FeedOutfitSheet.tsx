import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, Share2, Sparkles, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { FeedItem } from "./DiscoverFeed";

interface FeedOutfitSheetProps {
  item: FeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedOutfitSheet = ({ item, open, onOpenChange }: FeedOutfitSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());

  if (!item) return null;

  const handleWishlist = async (garment: FeedItem["garments"][0], idx: number) => {
    if (!user) { toast.error("Sign in to save items"); return; }
    if (savedIdxs.has(idx)) return;
    setSavingIdx(idx);
    try {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user.id,
        name: garment.name,
        brand: garment.brand,
        image_url: item.image,
      });
      if (error) throw error;
      setSavedIdxs((prev) => new Set(prev).add(idx));
      toast.success("Added to Wishlist");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingIdx(null);
    }
  };

  const handleShare = async (garment: FeedItem["garments"][0]) => {
    const shareData = {
      title: garment.name,
      text: `Check out this ${garment.name} by ${garment.brand} on VORA`,
      url: `https://vora.style/item/${encodeURIComponent(garment.name.toLowerCase().replace(/\s+/g, "-"))}`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied");
      }
    } catch {
      // User cancelled share dialog — no-op
    }
  };

  const handleAskAI = (garment: FeedItem["garments"][0]) => {
    onOpenChange(false);
    navigate(`/chat?shared_garment=${encodeURIComponent(garment.name)}&brand=${encodeURIComponent(garment.brand)}&category=${encodeURIComponent(garment.category)}`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSavedIdxs(new Set()); }}>
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
            <div key={idx} className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
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

              {/* Action buttons */}
              <div className="flex border-t border-border">
                <button
                  onClick={() => handleWishlist(garment, idx)}
                  disabled={savingIdx === idx || savedIdxs.has(idx)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted border-r border-border disabled:opacity-60"
                >
                  {savedIdxs.has(idx) ? (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Heart className="w-3.5 h-3.5" />
                  )}
                  {savedIdxs.has(idx) ? "Saved" : "Wishlist"}
                </button>
                <button
                  onClick={() => handleShare(garment)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted border-r border-border"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <button
                  onClick={() => handleAskAI(garment)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI
                </button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
