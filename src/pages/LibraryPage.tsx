import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SafeImage } from "@/components/ui/SafeImage";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface TrendingItem {
  id: string;
  title: string;
  brand: string | null;
  price: string | null;
  image_url: string | null;
  product_link: string | null;
  category: string | null;
}

const CATEGORIES = ["All", "Tops", "Bottoms", "Outerwear", "Shoes"] as const;

const LibraryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dreamIds, setDreamIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error: fetchErr } = await supabase
        .from("trending_clothes")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setItems(data || []);
      }
      setIsLoading(false);
    };
    fetchItems();
  }, []);

  // Load existing dream items to show filled hearts
  useEffect(() => {
    if (!user) return;
    const loadDreamItems = async () => {
      const { data } = await supabase
        .from("dream_items")
        .select("catalog_item_id")
        .eq("user_id", user.id);
      if (data) {
        setDreamIds(new Set(data.map((d) => d.catalog_item_id).filter(Boolean) as string[]));
      }
    };
    loadDreamItems();
  }, [user]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (activeCategory !== "All") {
      result = result.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.brand && item.brand.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, activeCategory, searchQuery]);

  const toggleDream = async (item: TrendingItem) => {
    if (!user) return;
    const isDreamed = dreamIds.has(item.id);
    setSavingId(item.id);

    if (isDreamed) {
      await supabase
        .from("dream_items")
        .delete()
        .eq("user_id", user.id)
        .eq("catalog_item_id", item.id);
      setDreamIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast({ title: "Removed from Dream List" });
    } else {
      await supabase.from("dream_items").insert({
        user_id: user.id,
        image_url: item.image_url || "",
        name: item.title,
        brand: item.brand,
        catalog_item_id: item.id,
      });
      setDreamIds((prev) => new Set(prev).add(item.id));
      toast({ title: "Added to Dream List! ✨" });
    }
    setSavingId(null);
  };

  return (
    <div className="pt-6 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground font-outfit">Trending Now</h1>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or brand…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 rounded-xl bg-card border-border/50"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-sm">Failed to load items. Pull down to retry.</p>
        </div>
      )}

      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-sm">
            {searchQuery || activeCategory !== "All"
              ? "No items match your filters."
              : "No trending items yet. Check back soon!"}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => {
            const isDreamed = dreamIds.has(item.id);
            return (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm"
              >
                <div className="relative">
                  <SafeImage
                    src={item.image_url || ""}
                    alt={item.title}
                    aspectRatio="aspect-square"
                    fit="cover"
                    className="rounded-t-2xl"
                  />
                  <button
                    onClick={() => toggleDream(item)}
                    disabled={savingId === item.id}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isDreamed
                          ? "fill-red-500 text-red-500"
                          : "text-foreground/60"
                      }`}
                    />
                  </button>
                </div>
                <div className="p-2.5 space-y-0.5">
                  {item.brand && (
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">
                      {item.brand}
                    </p>
                  )}
                  <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                  {item.price && (
                    <p className="text-xs font-semibold text-foreground">{item.price}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
