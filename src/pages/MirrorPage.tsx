import { useState } from "react";
import GlassCard from "@/components/GlassCard";
import { Sparkles, Check, Image, Loader2, AlertTriangle, Save, Trash2, GalleryHorizontalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  useClosetItems,
  useSelfieUrl,
  useSavedLooks,
  useLookGarments,
  useTryOnMutation,
  useSaveLookMutation,
  useDeleteLookMutation,
  type SavedLook,
} from "@/hooks/useMirrorData";

const OCCASIONS = ["Casual", "Date Night", "Work", "Party", "Streetwear"];

const MirrorPage = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [occasion, setOccasion] = useState<string | null>(null);
  const [tab, setTab] = useState<"tryon" | "gallery">("tryon");
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);

  // Data queries
  const { data: selfieUrl } = useSelfieUrl();
  const { data: closetData } = useClosetItems();
  const { data: looksData } = useSavedLooks();
  const { data: lookGarments = [] } = useLookGarments(selectedLook?.garment_ids ?? null);

  // Mutations
  const tryOnMutation = useTryOnMutation();
  const saveMutation = useSaveLookMutation();
  const deleteMutation = useDeleteLookMutation();

  const items = closetData?.items ?? [];
  const imageUrls = closetData?.urls ?? {};
  const looks = looksData?.looks ?? [];
  const lookUrls = looksData?.urls ?? {};

  const hasSelfie = !!selfieUrl;
  const hasItems = items.length > 0;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const handleTryOn = () => {
    if (!selfieUrl) {
      toast.error("No selfie found", { description: "Upload a selfie in your profile first." });
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select garments", { description: "Pick at least one item to try on." });
      return;
    }

    const garmentUrls = Array.from(selectedIds).map((id) => imageUrls[id]).filter(Boolean);
    const garmentIds = Array.from(selectedIds);

    tryOnMutation.mutate(
      { selfieUrl, garmentUrls, garmentIds, occasion },
      {
        onSuccess: (data) => {
          if (data.cached) {
            toast.info("Loaded from cache — instant result!");
          }
        },
      }
    );
  };

  const handleSaveLook = () => {
    const imagePath = tryOnMutation.data?.image_path;
    if (!imagePath) {
      // Fallback: upload from signed URL shouldn't happen with new flow,
      // but handle gracefully
      toast.error("Cannot save — no image path available.");
      return;
    }

    saveMutation.mutate({
      imagePath,
      occasion,
      garmentIds: Array.from(selectedIds),
    });
  };

  const handleDeleteLook = (look: SavedLook) => {
    deleteMutation.mutate(look, {
      onSuccess: () => setSelectedLook(null),
    });
  };

  const handleTryAnother = () => {
    tryOnMutation.reset();
  };

  // Empty state
  if (!hasItems && tab === "tryon") {
    return (
      <div className="pt-6 space-y-5">
        <h1 className="text-2xl font-bold text-foreground font-outfit">AI Stylist</h1>
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground font-outfit">AI Stylist</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] leading-relaxed">
            Add garments to your wardrobe first, then come back to try them on virtually
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-5 pb-4">
      <h1 className="text-2xl font-bold text-foreground font-outfit">AI Stylist</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab("tryon"); setSelectedLook(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            tab === "tryon"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Try On
        </button>
        <button
          onClick={() => setTab("gallery")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            tab === "gallery"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground"
          }`}
        >
          <GalleryHorizontalEnd className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          My Looks ({looks.length})
        </button>
      </div>

      {/* ========== GALLERY TAB ========== */}
      {tab === "gallery" && (
        <>
          {selectedLook ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard className="p-0 overflow-hidden">
                {lookUrls[selectedLook.id] ? (
                  <img src={lookUrls[selectedLook.id]} alt="Saved look" className="w-full rounded-2xl" />
                ) : (
                  <div className="aspect-square flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  </div>
                )}
              </GlassCard>
              <div className="flex items-center justify-between mt-3">
                <div>
                  {selectedLook.occasion && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {selectedLook.occasion}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(selectedLook.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl gap-1.5"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDeleteLook(selectedLook)}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </Button>
              </div>

              {/* Garment Details */}
              {lookGarments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Garments in this look</p>
                  {lookGarments.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.name || "Unnamed"}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {g.category && <span className="text-[10px] text-muted-foreground">{g.category}</span>}
                          {g.brand && <span className="text-[10px] text-muted-foreground">{g.brand}</span>}
                          {g.color && <span className="text-[10px] text-muted-foreground">{g.color}</span>}
                          {g.material && <span className="text-[10px] text-muted-foreground">{g.material}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="outline" className="w-full mt-3 rounded-xl" onClick={() => setSelectedLook(null)}>
                Back to gallery
              </Button>
            </motion.div>
          ) : looks.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <GalleryHorizontalEnd className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">No saved looks yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Generate a try-on and save it to build your look collection
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {looks.map((look) => (
                <GlassCard
                  key={look.id}
                  className="p-0 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedLook(look)}
                >
                  <div className="aspect-[3/4] bg-card">
                    {lookUrls[look.id] ? (
                      <img src={lookUrls[look.id]} alt="Saved look" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    {look.occasion && (
                      <span className="text-[10px] font-medium text-primary">{look.occasion}</span>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(look.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========== TRY-ON TAB ========== */}
      {tab === "tryon" && (
        <>
          {/* Selfie warning */}
          {!hasSelfie && (
            <GlassCard className="flex items-center gap-3 p-3 border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-xs text-muted-foreground">
                Upload a selfie in your <span className="text-foreground font-medium">Profile</span> to enable virtual try-on.
              </p>
            </GlassCard>
          )}

          {/* Result display */}
          <AnimatePresence mode="wait">
            {tryOnMutation.isPending ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Generating your look…</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">This may take 15–30 seconds</p>
                </GlassCard>
              </motion.div>
            ) : tryOnMutation.data?.image ? (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <GlassCard className="p-0 overflow-hidden">
                  <img src={tryOnMutation.data.image} alt="Virtual try-on result" className="w-full rounded-2xl" />
                </GlassCard>
                <div className="flex gap-2 mt-3">
                  <Button
                    className="flex-1 rounded-xl gap-2"
                    disabled={saveMutation.isPending}
                    onClick={handleSaveLook}
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Look
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={handleTryAnother}
                  >
                    Try another
                  </Button>
                </div>
              </motion.div>
            ) : tryOnMutation.isError ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GlassCard className="flex flex-col items-center py-10 text-center">
                  <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
                  <p className="text-sm text-foreground font-medium">Generation failed</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{tryOnMutation.error.message}</p>
                  <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => tryOnMutation.reset()}>
                    Dismiss
                  </Button>
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GlassCard className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Image className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[220px]">
                    Select garments below and tap <span className="text-foreground font-medium">Try On</span> to see yourself wearing them
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Occasion selector */}
          {!tryOnMutation.data && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Occasion (optional)</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(occasion === o ? null : o)}
                    className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
                      occasion === o
                        ? "bg-primary text-primary-foreground border border-primary"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Garment selector */}
          {!tryOnMutation.data && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Select garments ({selectedIds.size}/4)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                        isSelected ? "border-primary ring-1 ring-primary/30" : "border-transparent"
                      }`}
                    >
                      <div className="aspect-square bg-card">
                        {imageUrls[item.id] ? (
                          <img src={imageUrls[item.id]} alt={item.name || "Garment"} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate px-1.5 py-1">{item.name || "Unnamed"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Try On button */}
          {!tryOnMutation.data && (
            <Button
              className="w-full rounded-xl gap-2 h-12 text-base"
              size="lg"
              disabled={!hasSelfie || selectedIds.size === 0 || tryOnMutation.isPending}
              onClick={handleTryOn}
            >
              <Sparkles className="w-5 h-5" />
              Try On
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default MirrorPage;
