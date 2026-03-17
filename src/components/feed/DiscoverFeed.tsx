import { useState } from "react";
import { Heart, Bookmark, Sparkles } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Removed from Inspiration");
      } else {
        next.add(id);
        toast.success("Saved to Dream Wardrobe");
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
          const isSaved = savedItems.has(item.id);

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
                    onClick={() => toggleSave(item.id)}
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
