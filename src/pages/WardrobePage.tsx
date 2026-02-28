import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("closet");
  const [activeCategory, setActiveCategory] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [bulkQueue, setBulkQueue] = useState<AnalyzedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GarmentDisplay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: closetData } = useQuery({
    queryKey: ['closet', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closet_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return { items: [] as ClosetItem[], imageUrls: {} as Record<string, string> };

      const urls: Record<string, string> = {};
      const paths = data.map((item) => item.image_url).filter(Boolean);

      if (paths.length > 0) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from("garments")
          .createSignedUrls(paths, 3600);
        if (!urlError && urlData) {
          urlData.forEach((u, index) => {
            if (u.signedUrl) urls[data[index].id] = u.signedUrl;
          });
        }
      }
      return { items: data as ClosetItem[], imageUrls: urls };
    }
  });

  const { data: dreamItems = [] } = useQuery({
    queryKey: ['dream', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dream_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DreamItem[]) ?? [];
    }
  });

  const items = closetData?.items ?? [];
  const imageUrls = closetData?.imageUrls ?? {};
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  const handleRefresh = () => {
    if (activeTab === "closet") queryClient.invalidateQueries({ queryKey: ['closet', user?.id] });
    else queryClient.invalidateQueries({ queryKey: ['dream', user?.id] });
  };

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between h-10">
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
        ) : null}
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
                <div
                  key={item.id}
                  className="bg-[#FAF9F6] rounded-2xl overflow-hidden shadow-sm border border-black/5 cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "closet" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square w-full flex items-center justify-center bg-[#FAF9F6] p-2">
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
                    <p className="text-sm font-medium text-[#2A2A2A] truncate">{item.name || "Unnamed"}</p>
                    {item.category && (
                      <span className="text-[10px] text-[#6B6B6B]">{item.category}</span>
                    )}
                  </div>
                </div>
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
                <div
                  key={item.id}
                  className="bg-[#FAF9F6] rounded-2xl overflow-hidden shadow-sm border border-black/5 cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "dream" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square w-full flex items-center justify-center bg-[#FAF9F6] p-2">
                    <SafeImage
                      src={item.image_url}
                      alt={item.name || "Dream item"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      fit="contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[#2A2A2A] truncate">{item.name || "Unnamed"}</p>
                    <div className="flex items-center justify-between">
                      {item.brand && <span className="text-[10px] text-[#6B6B6B]">{item.brand}</span>}
                      {item.price != null && (
                        <span className="text-[10px] font-semibold text-primary">${item.price}</span>
                      )}
                    </div>
                  </div>
                </div>
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
            const [next, ...rest] = bulkQueue;
            setPrefill(next);
            setBulkQueue(rest);
            setTimeout(() => setAddOpen(true), 300);
          }
        }}
        onItemAdded={() => queryClient.invalidateQueries({ queryKey: ['closet', user?.id] })}
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
