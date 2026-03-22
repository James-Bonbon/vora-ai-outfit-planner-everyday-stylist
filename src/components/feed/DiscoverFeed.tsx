import { useState } from "react";
import { Bookmark, Sparkles, Heart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedOutfitSheet } from "./FeedOutfitSheet";

interface DiscoverFeedProps {
  layout?: "compact" | "full";
}

export interface FeedItem {
  id: string;
  title: string;
  curator: string;
  username: string;
  image: string;
  tags: string[];
  likes: number;
  garments: { name: string; category: string; brand: string }[];
}

const FEED_ITEMS: FeedItem[] = [
  {
    id: "1",
    title: "Weekend in the City",
    curator: "VORA Editorial",
    username: "@kaelie_styles",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=800",
    tags: ["Minimalist", "Autumn", "Neutral"],
    likes: 124,
    garments: [
      { name: "Oversized Wool Blazer", category: "Outerwear", brand: "COS" },
      { name: "Silk Camisole", category: "Tops", brand: "Aritzia" },
      { name: "High-Waist Trousers", category: "Bottoms", brand: "Massimo Dutti" },
    ],
  },
  {
    id: "2",
    title: "Office to Evening",
    curator: "Studio Collection",
    username: "@minimalist_edit",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    tags: ["Tailored", "Monochrome"],
    likes: 89,
    garments: [
      { name: "Structured Midi Skirt", category: "Bottoms", brand: "Theory" },
      { name: "Cashmere Turtleneck", category: "Tops", brand: "Everlane" },
      { name: "Pointed Leather Mules", category: "Shoes", brand: "Mango" },
    ],
  },
  {
    id: "3",
    title: "Sunday Coffee Run",
    curator: "VORA Editorial",
    username: "@studio_vora",
    image: "https://images.unsplash.com/photo-1434389678369-182cb1bc8e56?auto=format&fit=crop&q=80&w=800",
    tags: ["Casual", "Knitwear"],
    likes: 210,
    garments: [
      { name: "Chunky Knit Cardigan", category: "Outerwear", brand: "& Other Stories" },
      { name: "Wide-Leg Linen Pants", category: "Bottoms", brand: "Uniqlo" },
      { name: "Canvas Sneakers", category: "Shoes", brand: "Veja" },
    ],
  },
];

export const DiscoverFeed = ({ layout = "full" }: DiscoverFeedProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Local like state
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(FEED_ITEMS.map((i) => [i.id, i.likes]))
  );

  // Garment detail sheet
  const [selectedFeedItem, setSelectedFeedItem] = useState<FeedItem | null>(null);
  const [outfitSheetOpen, setOutfitSheetOpen] = useState(false);

  // Fetch saved wishlist items for bookmark state
  const { data: dreamItems = [] } = useQuery({
    queryKey: ["dream-items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dream_items")
        .select("id, name, image_url")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const savedImageUrls = new Set(dreamItems.map((d) => d.image_url));

  const saveMutation = useMutation({
    mutationFn: async (item: FeedItem) => {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user!.id,
        name: item.title,
        image_url: item.image,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dream-items"] });
      toast.success("Saved to Wishlist");
    },
    onError: () => toast.error("Failed to save item"),
  });

  const removeMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const { error } = await supabase
        .from("dream_items")
        .delete()
        .eq("user_id", user!.id)
        .eq("image_url", imageUrl);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dream-items"] });
      toast("Removed from Inspiration");
    },
    onError: () => toast.error("Failed to remove item"),
  });

  const displayItems = layout === "compact" ? FEED_ITEMS.slice(0, 1) : FEED_ITEMS;

  const toggleSave = (item: FeedItem) => {
    if (!user) { toast.error("Sign in to save items"); return; }
    if (savedImageUrls.has(item.image)) {
      removeMutation.mutate(item.image);
    } else {
      saveMutation.mutate(item);
    }
  };

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setLikeCounts((c) => ({ ...c, [id]: (c[id] || 1) - 1 }));
      } else {
        next.add(id);
        setLikeCounts((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground font-outfit">Discover</h3>
          <p className="text-xs text-muted-foreground">Curated looks for your aesthetic.</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      </div>

      {/* Feed Cards */}
      <div className="space-y-4">
        {displayItems.map((item) => {
          const isSaved = savedImageUrls.has(item.image);
          const isCompact = layout === "compact";
          const isLiked = likedIds.has(item.id);

          return (
            <GlassCard
              key={item.id}
              className={`p-0 overflow-hidden !rounded-2xl ${
                isCompact ? "border border-[hsl(90_8%_89%)] shadow-sm" : ""
              }`}
            >
              {/* Image — clickable to open garment view */}
              <div
                className="aspect-[4/5] bg-muted relative cursor-pointer"
                onClick={() => {
                  setSelectedFeedItem(item);
                  setOutfitSheetOpen(true);
                }}
              >
                <SafeImage
                  src={item.image}
                  alt={item.title}
                  aspectRatio=""
                  wrapperClassName="w-full h-full"
                  loading="lazy"
                />
                {isCompact && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[hsl(150_28%_23%)] text-white">
                    Featured Look
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-3.5 space-y-2.5">
                {/* Username */}
                <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {item.username}
                </p>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground font-outfit truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.curator}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Like button */}
                    <button
                      onClick={() => toggleLike(item.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isLiked
                            ? "fill-[hsl(150_28%_23%)] text-[hsl(150_28%_23%)]"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                    {/* Bookmark button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 w-8 h-8 rounded-full"
                      onClick={() => toggleSave(item)}
                      disabled={saveMutation.isPending || removeMutation.isPending}
                    >
                      <Bookmark
                        className={`w-4 h-4 transition-colors ${
                          isSaved ? "fill-primary text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Like count */}
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {likeCounts[item.id] || 0} likes
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Compact: View All link */}
      {layout === "compact" && (
        <div className="flex justify-center pt-1">
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground gap-1.5">
            <Link to="/feed">
              View All Inspiration
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Garment detail sheet */}
      <FeedOutfitSheet
        item={selectedFeedItem}
        open={outfitSheetOpen}
        onOpenChange={setOutfitSheetOpen}
      />
    </div>
  );
};
