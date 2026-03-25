import { useState } from "react";
import { Bookmark, Sparkles, Heart, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedOutfitSheet } from "./FeedOutfitSheet";
import { UploadOutfitModal } from "./UploadOutfitModal";
import { FEED_ITEMS, type OutfitPost } from "@/data/mockFeedData";
export type { OutfitPost } from "@/data/mockFeedData";

interface DiscoverFeedProps {
  layout?: "compact" | "full";
}

export const DiscoverFeed = ({ layout = "full" }: DiscoverFeedProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [userPosts, setUserPosts] = useState<OutfitPost[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(FEED_ITEMS.map((i) => [i.id, i.likesCount]))
  );

  const [selectedFeedItem, setSelectedFeedItem] = useState<OutfitPost | null>(null);
  const [outfitSheetOpen, setOutfitSheetOpen] = useState(false);

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
    mutationFn: async (item: OutfitPost) => {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user!.id,
        name: item.description,
        image_url: item.main_image_url,
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

  const allItems = [...userPosts, ...FEED_ITEMS];
  const displayItems = layout === "compact" ? allItems.slice(0, 1) : allItems;

  const handlePublishOutfit = (post: OutfitPost) => {
    setUserPosts((prev) => [post, ...prev]);
    setLikeCounts((c) => ({ ...c, [post.id]: 0 }));
  };

  const toggleSave = (item: OutfitPost) => {
    if (!user) { toast.error("Sign in to save items"); return; }
    if (savedImageUrls.has(item.main_image_url)) {
      removeMutation.mutate(item.main_image_url);
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
          const isSaved = savedImageUrls.has(item.main_image_url);
          const isCompact = layout === "compact";
          const isLiked = likedIds.has(item.id);

          return (
            <GlassCard
              key={item.id}
              className={`p-0 overflow-hidden !rounded-2xl ${
                isCompact ? "border border-[hsl(90_8%_89%)] shadow-sm" : ""
              }`}
            >
              {/* Image with gradient overlay */}
              <div
                className="aspect-[4/5] bg-muted relative cursor-pointer overflow-hidden rounded-t-2xl"
                onClick={() => {
                  setSelectedFeedItem(item);
                  setOutfitSheetOpen(true);
                }}
              >
                <SafeImage
                  src={item.main_image_url}
                  alt={item.description}
                  aspectRatio=""
                  wrapperClassName="w-full h-full"
                  loading="lazy"
                />
                {/* Dark gradient overlay for username legibility */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
                {/* Username on image */}
                <span className="absolute bottom-3 left-3.5 text-white text-[13px] font-semibold tracking-wide drop-shadow-sm">
                  {item.username}
                </span>
                {isCompact && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[hsl(150_28%_23%)] text-white">
                    Featured Look
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground font-outfit truncate">
                      {item.description}
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

      {/* Outfit detail sheet */}
      <FeedOutfitSheet
        item={selectedFeedItem}
        open={outfitSheetOpen}
        onOpenChange={setOutfitSheetOpen}
      />

      {/* FAB for upload */}
      {layout === "full" && (
        <button
          onClick={() => setUploadOpen(true)}
          className="fixed bottom-24 right-5 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Upload Modal */}
      <UploadOutfitModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPublish={handlePublishOutfit}
        username={user?.user_metadata?.username || user?.email?.split("@")[0] ? `@${user?.email?.split("@")[0]}` : "@you"}
      />
    </div>
  );
};
