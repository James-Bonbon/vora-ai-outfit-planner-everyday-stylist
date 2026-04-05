import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Plus, Library, Camera, Loader2, WashingMachine, AlertTriangle } from "lucide-react";
import CabinetIcon from "@/components/icons/CabinetIcon";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddItemSheet from "@/components/wardrobe/AddItemSheet";
import type { PrefillData } from "@/components/wardrobe/AddItemSheet";
import GarmentDetailSheet from "@/components/wardrobe/GarmentDetailSheet";
import SmartCamera from "@/components/wardrobe/SmartCamera";
import type { AnalyzedItem } from "@/components/wardrobe/SmartCamera";
import type { ClosetItem, DreamItem, GarmentDisplay } from "@/types/wardrobe";
import { WardrobeMap } from "@/components/wardrobe/WardrobeMap";
import { LookbookTab } from "@/components/wardrobe/LookbookTab";
import { normalizeToPng } from "@/utils/imageProcessing";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = ["All", "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];

type TabValue = "closet" | "lookbook" | "dream";

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

  // Smart Laundry state
  const [needsLaundryReview, setNeedsLaundryReview] = useState<ClosetItem[]>([]);

  // Wardrobe Map state
  const [mapOpen, setMapOpen] = useState(false);
  const [closetSvg, setClosetSvg] = useState<string | null>(null);
  const [generatingMap, setGeneratingMap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing SVG
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("closet_svg")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.closet_svg) setClosetSvg(data.closet_svg);
      });
  }, [user]);

  const handleClosetPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGeneratingMap(true);
    try {
      const normalizedBlob = await normalizeToPng(file);
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(normalizedBlob);
      });
      const { data, error } = await supabase.functions.invoke("generate-wardrobe-svg", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.svg) {
        setClosetSvg(data.svg);
        toast.success("Wardrobe map generated! ✨");
      } else {
        throw new Error("No SVG returned");
      }
    } catch (err: any) {
      console.error("Wardrobe map error:", err);
      toast.error(err.message || "Failed to generate wardrobe map.");
    } finally {
      setGeneratingMap(false);
    }
  };

  const { data: closetData, isLoading: isClosetLoading } = useQuery({
    queryKey: ["closet", user?.id],
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
    },
  });

  const { data: dreamItems = [], isLoading: isDreamLoading } = useQuery({
    queryKey: ["dream", user?.id],
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
    },
  });

  const items = closetData?.items ?? [];
  const imageUrls = closetData?.imageUrls ?? {};
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  // Smart Laundry: detect stale items (7+ days in laundry)
  useEffect(() => {
    if (!items.length) { setNeedsLaundryReview([]); return; }
    const now = new Date();
    const staleItems = items.filter((item: any) => {
      if (!item.is_in_laundry || !item.laundry_added_at) return false;
      const daysInLaundry = (now.getTime() - new Date(item.laundry_added_at).getTime()) / (1000 * 3600 * 24);
      if (daysInLaundry < 7) return false;
      if (!item.last_laundry_reminder_at) return true;
      const daysSinceReminder = (now.getTime() - new Date(item.last_laundry_reminder_at).getTime()) / (1000 * 3600 * 24);
      return daysSinceReminder >= 3;
    });
    setNeedsLaundryReview(staleItems);
  }, [items]);

  const handleToggleLaundry = async (item: ClosetItem, isNowDirty: boolean) => {
    const payload = isNowDirty
      ? { is_in_laundry: true, laundry_added_at: new Date().toISOString(), last_laundry_reminder_at: null }
      : { is_in_laundry: false, laundry_added_at: null, last_laundry_reminder_at: null };
    await supabase.from("closet_items").update(payload).eq("id", item.id);
    handleRefresh();
    toast.success(isNowDirty ? "Moved to laundry" : "Marked as clean");
  };

  const handleMarkAllClean = async (staleItems: ClosetItem[]) => {
    const ids = staleItems.map((i) => i.id);
    await supabase.from("closet_items").update({ is_in_laundry: false, laundry_added_at: null, last_laundry_reminder_at: null }).in("id", ids);
    setNeedsLaundryReview([]);
    handleRefresh();
    toast.success("All items marked as clean!");
  };

  const handleSnoozeReminders = async (staleItems: ClosetItem[]) => {
    const ids = staleItems.map((i) => i.id);
    await supabase.from("closet_items").update({ last_laundry_reminder_at: new Date().toISOString() }).in("id", ids);
    setNeedsLaundryReview([]);
    toast.info("Snoozed for 3 days");
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["closet"] });
    queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    if (activeTab === "dream") queryClient.invalidateQueries({ queryKey: ["dream", user?.id] });
  };

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Wardrobe</h1>
        {activeTab === "closet" && (
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => setMapOpen(true)}
            >
              <CabinetIcon className="!w-6 !h-6 text-foreground" strokeWidth={1} />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="!w-6 !h-6 text-foreground stroke-[1]" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => {
                setPrefill(null);
                setAddOpen(true);
              }}
            >
              <Plus className="!w-6 !h-6 text-foreground stroke-[1]" />
            </Button>
          </div>
        )}
        {activeTab === "dream" && (
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => navigate("/library")}>
            <Plus className="w-4 h-4" />
            Browse Library
          </Button>
        )}
        {activeTab === "lookbook" && <div />}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {(["closet", "lookbook", "dream"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {tab === "closet" ? "My Closet" : tab === "lookbook" ? "Lookbook" : "Wishlist"}
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

          {isClosetLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading your wardrobe...</p>
            </div>
          ) : filtered.length === 0 ? (
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
                  className="bg-product-bg rounded-2xl overflow-hidden shadow-sm border border-border cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "closet" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square w-full flex items-center justify-center bg-product-bg p-2">
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
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">{item.name || "Unnamed"}</p>
                    {item.category && <span className="text-[10px] text-[#555]">{item.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lookbook Tab */}
      {activeTab === "lookbook" && <LookbookTab items={items} imageUrls={imageUrls} />}

      {/* Wishlist Tab */}
      {activeTab === "dream" && (
        <>
          {isDreamLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading wishlist...</p>
            </div>
          ) : dreamItems.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Library className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Build your Wishlist</h3>
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
                  className="bg-product-bg rounded-2xl overflow-hidden shadow-sm border border-border cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "dream" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square w-full flex items-center justify-center bg-product-bg p-2">
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
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">{item.name || "Unnamed"}</p>
                    <div className="flex items-center justify-between">
                      {item.brand && <span className="text-[10px] text-[#555]">{item.brand}</span>}
                      {item.price != null && (
                        <span className="text-[10px] font-semibold text-[#2c4c3b]">${item.price}</span>
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
        onItemAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["closet"] });
          queryClient.invalidateQueries({ queryKey: ["closet-items"] });
        }}
        prefill={prefill}
      />
      <GarmentDetailSheet
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={handleRefresh}
      />
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

      {/* Wardrobe Map Dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-outfit">AI Wardrobe Map</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {closetSvg ? (
              <WardrobeMap svgString={closetSvg} />
            ) : (
              <div className="text-center py-6">
                <CabinetIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Take a photo of your closet and AI will create an interactive map of its compartments.
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleClosetPhotoSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={generatingMap}
              className="w-full rounded-xl gap-2"
              variant={closetSvg ? "outline" : "default"}
            >
              {generatingMap ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing your closet…
                </>
              ) : closetSvg ? (
                "Retake Photo"
              ) : (
                "Take Closet Photo"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WardrobePage;
