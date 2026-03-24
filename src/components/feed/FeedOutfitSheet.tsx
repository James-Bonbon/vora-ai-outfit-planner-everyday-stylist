import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, Share2, Sparkles, Check, Bookmark, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { OutfitPost, Garment } from "@/data/mockFeedData";

interface FeedOutfitSheetProps {
  item: OutfitPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedOutfitSheet = ({ item, open, onOpenChange }: FeedOutfitSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [outfitSaved, setOutfitSaved] = useState(false);

  if (!item) return null;

  /* ── Individual garment actions ─────────────────────────── */
  const handleWishlist = async (garment: Garment, idx: number) => {
    if (!user) { toast.error("Sign in to save items"); return; }
    if (savedIdxs.has(idx)) return;
    setSavingIdx(idx);
    try {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user.id,
        name: garment.name,
        brand: garment.brand,
        image_url: garment.flat_lay_image_url || item.main_image_url,
        item_type: "garment",
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

  const handleShare = async (garment: Garment) => {
    const shareData = {
      title: garment.name,
      text: `Check out this ${garment.name} by ${garment.brand} on VORA`,
      url: `https://vora.style/item/${encodeURIComponent(garment.name.toLowerCase().replace(/\s+/g, "-"))}`,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  const handleAskAI = (garment: Garment) => {
    onOpenChange(false);
    navigate(`/chat?shared_garment=${encodeURIComponent(garment.name)}&brand=${encodeURIComponent(garment.brand)}&category=${encodeURIComponent(garment.category)}`);
  };

  /* ── Outfit-level actions ───────────────────────────────── */
  const handleSaveFullLook = async () => {
    if (!user) { toast.error("Sign in to save looks"); return; }
    if (outfitSaved) return;
    setSavingOutfit(true);
    try {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user.id,
        name: item.description,
        brand: item.username,
        image_url: item.main_image_url,
        item_type: "outfit",
        garments_json: JSON.parse(JSON.stringify(item.outfit_breakdown)),
      });
      if (error) throw error;
      setOutfitSaved(true);
      toast.success("Outfit added to Wishlist");
    } catch {
      toast.error("Failed to save outfit");
    } finally {
      setSavingOutfit(false);
    }
  };

  const handleShareOutfit = async () => {
    const shareData = {
      title: item.description,
      text: `Check out this look by ${item.username} on VORA`,
      url: `https://vora.style/look/${encodeURIComponent(item.id)}`,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareData.url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  const handleAskAIOutfit = () => {
    onOpenChange(false);
    const garmentsSummary = item.outfit_breakdown
      .map((g) => `${g.name} by ${g.brand} (${g.category})`)
      .join("|");
    navigate(`/chat?outfit_name=${encodeURIComponent(item.description)}&outfit_garments=${encodeURIComponent(garmentsSummary)}`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSavedIdxs(new Set()); setOutfitSaved(false); } }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-outfit text-lg">{item.description}</SheetTitle>
          <p className="text-[11px] text-muted-foreground font-semibold tracking-wide">
            {item.username}
          </p>
        </SheetHeader>

        {/* ── Outfit-Level Master Action Bar ──────────────────── */}
        <div className="mt-4 flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={handleSaveFullLook}
            disabled={savingOutfit || outfitSaved}
          >
            {outfitSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            {outfitSaved ? "Saved" : "Save Full Look"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleShareOutfit}>
            <Send className="w-3.5 h-3.5" />
            Share Outfit
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleAskAIOutfit}>
            <Sparkles className="w-3.5 h-3.5" />
            Ask AI
          </Button>
        </div>

        {/* ── Individual Garments ─────────────────────────────── */}
        <div className="space-y-3 mt-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Outfit Breakdown
          </p>

          {item.outfit_breakdown.map((garment, idx) => (
            <div key={garment.id} className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                {/* Flat-lay thumbnail */}
                <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                  {garment.flat_lay_image_url ? (
                    <img
                      src={garment.flat_lay_image_url}
                      alt={garment.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        target.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-[10px] text-muted-foreground font-medium">${garment.category}</span>`;
                      }}
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-[10px] text-muted-foreground font-medium">
                      {garment.category}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{garment.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {garment.brand} · {garment.category}
                  </p>
                </div>
              </div>

              <div className="flex border-t border-border">
                <button
                  onClick={() => handleWishlist(garment, idx)}
                  disabled={savingIdx === idx || savedIdxs.has(idx)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted border-r border-border disabled:opacity-60"
                >
                  {savedIdxs.has(idx) ? <Check className="w-3.5 h-3.5 text-primary" /> : <Heart className="w-3.5 h-3.5" />}
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
