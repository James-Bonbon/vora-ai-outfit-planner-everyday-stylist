import { useEffect, useState, useCallback } from "react";
import GlassCard from "@/components/GlassCard";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddItemSheet from "@/components/wardrobe/AddItemSheet";
import GarmentDetailSheet from "@/components/wardrobe/GarmentDetailSheet";

interface ClosetItem {
  id: string;
  image_url: string;
  name: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
  notes: string | null;
  created_at: string;
}

const CATEGORIES = ["All", "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];

const WardrobePage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClosetItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("closet_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setItems(data as ClosetItem[]);
      // Fetch signed URLs for all images
      const urls: Record<string, string> = {};
      await Promise.all(
        data.map(async (item: ClosetItem) => {
          const { data: urlData } = await supabase.storage
            .from("garments")
            .createSignedUrl(item.image_url, 3600);
          if (urlData?.signedUrl) urls[item.id] = urlData.signedUrl;
        })
      );
      setImageUrls(urls);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Wardrobe</h1>
        <Button size="icon" className="rounded-xl h-10 w-10" onClick={() => setAddOpen(true)}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border border-primary"
                : "border border-border text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid or Empty State */}
      {filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Your closet is empty</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            Add your first item by tapping the + button above
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => (
            <GlassCard
              key={item.id}
              className="p-0 overflow-hidden cursor-pointer"
              onClick={() => {
                setSelectedItem(item);
                setDetailOpen(true);
              }}
            >
              <div className="aspect-square bg-card">
                {imageUrls[item.id] ? (
                  <img
                    src={imageUrls[item.id]}
                    alt={item.name || "Garment"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
                {item.category && (
                  <span className="text-[10px] text-muted-foreground">{item.category}</span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} onItemAdded={fetchItems} />
      <GarmentDetailSheet item={selectedItem} open={detailOpen} onOpenChange={setDetailOpen} onDeleted={fetchItems} />
    </div>
  );
};

export default WardrobePage;
