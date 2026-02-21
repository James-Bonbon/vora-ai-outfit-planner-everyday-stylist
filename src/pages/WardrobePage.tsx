import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Plus, Library, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddItemSheet from "@/components/wardrobe/AddItemSheet";
import type { PrefillData } from "@/components/wardrobe/AddItemSheet";
import GarmentDetailSheet from "@/components/wardrobe/GarmentDetailSheet";
import SmartCamera from "@/components/wardrobe/SmartCamera";
import type { AnalyzedItem } from "@/components/wardrobe/SmartCamera";
import type { ClosetItem, DreamItem, GarmentDisplay } from "@/types/wardrobe";

const CATEGORIES = ["All", "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];

type TabValue = "closet" | "dream";

const WardrobePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>("closet");

  // Closet state
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [bulkQueue, setBulkQueue] = useState<AnalyzedItem[]>([]);

  // Dream state
  const [dreamItems, setDreamItems] = useState<DreamItem[]>([]);

  // Shared detail sheet
  const [selectedItem, setSelectedItem] = useState<GarmentDisplay | null>(null);
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

  const fetchDreamItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dream_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setDreamItems(data as DreamItem[]);
  }, [user]);

  useEffect(() => {
    fetchItems();
    fetchDreamItems();
  }, [fetchItems, fetchDreamItems]);

  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  const handleRefresh = () => {
    if (activeTab === "closet") fetchItems();
    else fetchDreamItems();
  };

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Wardrobe</h1>
        {activeTab === "closet" ? (
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="rounded-xl h-10 w-10" onClick={() => setCameraOpen(true)}>
              <Camera className="w-5 h-5" />
            </Button>
            <Button size="icon" className="rounded-xl h-10 w-10" onClick={() => { setPrefill(null); setAddOpen(true); }}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <Button className="rounded-xl gap-2 h-10" onClick={() => navigate("/library")}>
            <Library className="w-4 h-4" />
            Browse Library
          </Button>
        )}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {(["closet", "dream"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {tab === "closet" ? "My Closet" : "Dream List"}
          </button>
        ))}
      </div>

      {/* My Closet Tab */}
      {activeTab === "closet" && (
        <>
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
                    setSelectedItem({ ...item, source: "closet" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square bg-[#F4F4F4] p-[12%] flex items-center justify-center">
                    <SafeImage
                      src={imageUrls[item.id]}
                      alt={item.name || "Garment"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      fit="contain"
                      className="drop-shadow-[0px_10px_15px_rgba(0,0,0,0.1)]"
                      loading="lazy"
                    />
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
        </>
      )}

      {/* Dream List Tab */}
      {activeTab === "dream" && (
        <>
          {dreamItems.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Library className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Build your Dream Wardrobe</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Browse thousands of items from our library and try them on.
              </p>
              <Button className="mt-4 rounded-xl gap-2" onClick={() => navigate("/library")}>
                <Library className="w-4 h-4" />
                Browse Library
              </Button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {dreamItems.map((item) => (
                <GlassCard
                  key={item.id}
                  className="p-0 overflow-hidden cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "dream" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square bg-card">
                    <SafeImage
                      src={item.image_url}
                      alt={item.name || "Dream item"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
                    <div className="flex items-center justify-between">
                      {item.brand && <span className="text-[10px] text-muted-foreground">{item.brand}</span>}
                      {item.price != null && (
                        <span className="text-[10px] font-semibold text-primary">${item.price}</span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      <AddItemSheet
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v && bulkQueue.length > 0) {
            // Auto-open next item in queue
            const [next, ...rest] = bulkQueue;
            setPrefill(next);
            setBulkQueue(rest);
            setTimeout(() => setAddOpen(true), 300);
          }
        }}
        onItemAdded={fetchItems}
        prefill={prefill}
      />
      <GarmentDetailSheet item={selectedItem} open={detailOpen} onOpenChange={setDetailOpen} onDeleted={handleRefresh} />
      <SmartCamera
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onAnalyzed={(items: AnalyzedItem[]) => {
          if (items.length === 1) {
            setPrefill(items[0]);
            setAddOpen(true);
          } else if (items.length > 1) {
            // Open first item for review, queue rest
            setPrefill(items[0]);
            setBulkQueue(items.slice(1));
            setAddOpen(true);
          }
        }}
      />
    </div>
  );
};

export default WardrobePage;
