import { useState, useEffect } from "react";
import { Bookmark, Sparkles, Loader2 } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const FEED_ITEMS = [
  {
    id: "1",
    title: "Weekend in the City",
    curator: "VORA Editorial",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=800",
    tags: ["Minimalist", "Autumn", "Neutral"],
    likes: 124,
  },
  {
    id: "2",
    title: "Office to Evening",
    curator: "Studio Collection",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    tags: ["Tailored", "Monochrome"],
    likes: 89,
  },
  {
    id: "3",
    title: "Sunday Coffee Run",
    curator: "VORA Editorial",
    image: "https://images.unsplash.com/photo-1434389678369-182cb1bc8e56?auto=format&fit=crop&q=80&w=800",
    tags: ["Casual", "Knitwear"],
    likes: 210,
  },
];

export const DiscoverFeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch saved dream items to know which feed items are already bookmarked
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

  // Build a set of saved image_urls for quick lookup
  const savedImageUrls = new Set(dreamItems.map((d) => d.image_url));

  const saveMutation = useMutation({
    mutationFn: async (item: (typeof FEED_ITEMS)[0]) => {
      const { error } = await supabase.from("dream_items").insert({
        user_id: user!.id,
        name: item.title,
        image_url: item.image,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dream-items"] });
      toast.success("Saved to Dream Wardrobe");
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

  const toggleSave = (item: (typeof FEED_ITEMS)[0]) => {
    if (!user) {
      toast.error("Sign in to save items");
      return;
    }
    if (savedImageUrls.has(item.image)) {
      removeMutation.mutate(item.image);
    } else {
      saveMutation.mutate(item);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground font-outfit">Discover</h3>
          <p className="text-xs text-muted-foreground">
            Curated looks for your aesthetic.
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      </div>

      {/* Feed Cards */}
      <div className="space-y-4">
        {FEED_ITEMS.map((item) => {
          const isSaved = savedImageUrls.has(item.image);

          return (
            <GlassCard key={item.id} className="p-0 overflow-hidden !rounded-2xl">
              {/* Image */}
              <div className="aspect-[4/5] bg-muted relative">
                <SafeImage
                  src={item.image}
                  alt={item.title}
                  aspectRatio=""
                  wrapperClassName="w-full h-full"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground font-outfit truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.curator}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 w-8 h-8 rounded-full"
                    onClick={() => toggleSave(item)}
                    disabled={saveMutation.isPending || removeMutation.isPending}
                  >
                    <Bookmark
                      className={`w-4 h-4 transition-colors ${
                        isSaved
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                </div>

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
    </div>
  );
};
