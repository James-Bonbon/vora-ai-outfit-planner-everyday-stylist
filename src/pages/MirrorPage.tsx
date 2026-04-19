import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import {
  Sparkles,
  Check,
  Image,
  Loader2,
  AlertTriangle,
  Save,
  Trash2,
  GalleryHorizontalEnd,
  Lock,
  Star,
  MessageCircle,
  Globe,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StylistChat } from "@/components/chat/StylistChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { ignoreToastInteractOutside } from "@/lib/radixToastGuard";

import { toast } from "sonner";
import {
  useClosetItems,
  useDreamItems,
  useSelfieUrl,
  useSavedLooks,
  useLookGarments,
  useTryOnMutation,
  useSaveLookMutation,
  useDeleteLookMutation,
  useTogglePublishMutation,
  useProfileData,
  type SavedLook,
} from "@/hooks/useMirrorData";

const OCCASIONS = ["Casual", "Date Night", "Work", "Party", "Streetwear"];

const MirrorPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const outfitPlan = location.state as { vibe?: string; weather?: string; preSelectedIds?: string[] } | null;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [occasion, setOccasion] = useState<string | null>(outfitPlan?.vibe ?? null);
  const [tab, setTab] = useState<"tryon" | "gallery">("tryon");
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);
  const [desiredLook, setDesiredLook] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [useVoraModel, setUseVoraModel] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [sharedLookIds, setSharedLookIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Data queries
  const { data: selfieUrl } = useSelfieUrl();
  const { data: closetData } = useClosetItems();
  const { data: dreamData } = useDreamItems();
  const { data: looksData } = useSavedLooks();
  const { data: profileData } = useProfileData();
  const bodyShape = profileData?.body_shape;
  const { data: lookGarments = [] } = useLookGarments(selectedLook?.garment_ids ?? null);

  // Mutations
  const tryOnMutation = useTryOnMutation();
  const saveMutation = useSaveLookMutation();
  const deleteMutation = useDeleteLookMutation();
  const publishMutation = useTogglePublishMutation();

  // Force Vora model if no selfie
  useEffect(() => {
    if (!selfieUrl && !tryOnMutation.isPending) {
      setUseVoraModel(true);
    }
  }, [selfieUrl, tryOnMutation.isPending]);

  const voraModelUrl = supabase.storage
    .from('assets')
    .getPublicUrl(profileData?.gender?.toLowerCase() === 'male' ? 'nickson.png' : 'kaelie.png')
    .data.publicUrl;

  const activeImageUrl = useVoraModel ? voraModelUrl : selfieUrl;

  // Combine closet + dream items for the stylist
  const closetItems = closetData?.items ?? [];
  const dreamItems = dreamData?.items ?? [];
  const items = [...closetItems, ...dreamItems];
  const imageUrls = { ...(closetData?.urls ?? {}), ...(dreamData?.urls ?? {}) };

  // Wire up pre-selected garments from OutfitCalendar navigation
  useEffect(() => {
    if (outfitPlan?.preSelectedIds && outfitPlan.preSelectedIds.length > 0 && items.length > 0) {
      const validIds = outfitPlan.preSelectedIds.filter((id) => items.some((i) => i.id === id));
      if (validIds.length > 0) {
        setSelectedIds(new Set(validIds));
      }
    }
  }, [items]); // re-run when items load

  // MAGIC STYLIST THRESHOLD LOGIC (Requires 7 Tops & 3 Bottoms)
  const TOP_RE = /\b(top|shirt|blazer|sweater|knit|jacket|coat|polo|camisole|cardigan|hoodie)\b/i;
  const BOTTOM_RE = /\b(bottom|trouser|pant|jeans|skirt|short|chinos|sweatpants)\b/i;
  const MIN_TOPS = 7;
  const MIN_BOTTOMS = 3;

  const topsCount = items.filter((i) => TOP_RE.test(i.category || "") || TOP_RE.test(i.name || "")).length;
  const bottomsCount = items.filter((i) => BOTTOM_RE.test(i.category || "") || BOTTOM_RE.test(i.name || "")).length;
  const meetsThreshold = topsCount >= MIN_TOPS && bottomsCount >= MIN_BOTTOMS;
  const looks = looksData?.looks ?? [];
  const lookUrls = looksData?.urls ?? {};

  const hasItems = items.length > 0;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
        return next;
      }

      // Smart Category Swapping
      const itemToAdd = items.find((i) => i.id === id);
      if (itemToAdd?.category) {
        const strictCategories = ["Tops", "Bottoms", "Shoes", "Outerwear", "Dresses"];
        if (strictCategories.includes(itemToAdd.category)) {
          const conflictId = Array.from(next).find((existingId) => {
            const existingItem = items.find((i) => i.id === existingId);
            return existingItem?.category === itemToAdd.category;
          });
          if (conflictId) next.delete(conflictId);
        }
      }

      if (next.size < 4) {
        next.add(id);
      } else {
        toast.error("Maximum 4 items allowed.");
      }

      return next;
    });
  };

  const handleTryOn = () => {
    if (selectedIds.size === 0 && !occasion && !desiredLook.trim()) {
      toast.error("Need direction", {
        description: "Select garments manually, or pick an Occasion so I can style you!",
      });
      return;
    }

    let finalGarmentIds = new Set(selectedIds);
    const hasDirection = !!occasion || !!desiredLook.trim();

    // ==========================================
    // SMART OUTFIT COMPLETER LOGIC
    // ==========================================
    if (hasDirection && finalGarmentIds.size < 4) {
      const selectedItems = Array.from(finalGarmentIds)
        .map((id) => items.find((i) => i.id === id))
        .filter(Boolean);
      const selectedCategories = selectedItems.map((i) => i?.category?.toLowerCase());
      const hasTop = selectedCategories.includes("tops");
      const hasBottom = selectedCategories.includes("bottoms");
      const hasDress = selectedCategories.includes("dresses") || selectedCategories.includes("one-piece");
      const hasShoes = selectedCategories.includes("shoes");
      const hasOuterwear = selectedCategories.includes("outerwear");

      const neededCategories: string[] = [];
      if (!hasDress) {
        if (!hasTop) neededCategories.push("tops");
        if (!hasBottom) neededCategories.push("bottoms");
      }
      if (!hasShoes) neededCategories.push("shoes");
      if (!hasOuterwear) neededCategories.push("outerwear");

      const occasionKeywords: Record<string, string[]> = {
        work: ["blazer", "trouser", "shirt", "loafers", "tailored", "smart"],
        "date night": ["dress", "skirt", "heel", "silk", "satin", "leather"],
        casual: ["jeans", "t-shirt", "sneakers", "denim", "cotton", "hoodie"],
        party: ["mini", "sequin", "leather", "heels", "party", "statement"],
        streetwear: ["hoodie", "cargo", "sneakers", "oversized", "jacket"],
      };

      const keywords = occasion ? occasionKeywords[occasion.toLowerCase()] || [] : [];
      const availableItems = items.filter((i) => !finalGarmentIds.has(i.id));
      let itemsAdded = 0;

      for (const cat of neededCategories) {
        if (finalGarmentIds.size >= 4) break;
        const catItems = availableItems.filter((i) => i.category?.toLowerCase() === cat);
        if (catItems.length === 0) continue;

        let matchedItem = catItems.find((i) => keywords.some((kw) => i.name?.toLowerCase().includes(kw)));

        if (!matchedItem) {
          matchedItem = catItems[Math.floor(Math.random() * catItems.length)];
        }

        if (matchedItem) {
          finalGarmentIds.add(matchedItem.id);
          itemsAdded++;
        }
      }

      if (itemsAdded > 0) {
        setSelectedIds(new Set(finalGarmentIds));
        toast.success("Outfit completed! ✨", {
          description: `Added ${itemsAdded} item(s) to match your ${occasion || "look"}.`,
        });
      } else if (finalGarmentIds.size === 0) {
        toast.error("Wardrobe too empty", {
          description: "Not enough items to auto-style. Please pick items manually.",
        });
        return;
      }
    }

    // ==========================================
    // EXECUTE API CALL
    // ==========================================
    const garmentIdsArray = Array.from(finalGarmentIds);
    const garmentUrls = garmentIdsArray.map((id) => imageUrls[id]).filter(Boolean);

    const shapePrompts: Record<string, string> = {
      // Female / Neutral
      Slim: "tailored slim fit, close to the body, clean narrow silhouette",
      Balanced: "naturally contoured tailored fit, balanced upper and lower proportions, standard drape",
      Fuller:
        "relaxed fit, comfortable drape, elongated vertical lines, soft tailored structure with slightly more volume",
      // Male specific
      Athletic: "broad shoulders, v-taper silhouette, narrow waist, structured muscular fit",
      Broad: "relaxed fit, comfortable drape across the midsection, wider frame, robust build, straight lines",
    };
    const shapeInstruction = bodyShape ? shapePrompts[bodyShape] : null;

    const finalDesiredLook = [
      shapeInstruction ? `Ensure a ${shapeInstruction}` : null,
      occasion ? `Style suitable for a ${occasion} occasion` : null,
      desiredLook.trim(),
      "CRITICAL INSTRUCTION: Strictly maintain the exact original facial features, identity, hair color, and hairstyle from the source selfie. Do not alter, repaint, or modify the head, face, or hair in any way.",
      "Professional fashion photography, subject perfectly centered, waist-up portrait, head and torso fully visible, well-framed, maintain 3:4 aspect ratio",
    ]
      .filter(Boolean)
      .join(". ");

    tryOnMutation.mutate(
      {
        // Photoroom needs a real, fetchable face image. Prefer the user's
        // signed selfie URL; fall back to the Vora placeholder only if absent.
        selfieUrl: (selfieUrl || activeImageUrl)!,
        garmentUrls,
        garmentIds: garmentIdsArray,
        occasion,
        desiredLook: finalDesiredLook || null,
        weather: outfitPlan?.weather ?? null,
        bodyShape: bodyShape ?? null,
      },
      {
        onSuccess: (data) => {
          if (data.cached) {
            toast.info("Loaded from cache — instant result!");
          }
        },
      },
    );
  };

  const handleSaveLook = async () => {
    let imagePath = tryOnMutation.data?.image_path;
    const rawImage = tryOnMutation.data?.image;

    if (!imagePath && rawImage?.startsWith("data:image")) {
      try {
        const base64Data = rawImage.split(",")[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "image/png" });
        
        const newPath = `${user?.id}/look_${Date.now()}.png`;
        const { error: uploadErr } = await supabase.storage.from("looks").upload(newPath, blob);
        if (uploadErr) throw uploadErr;
        
        imagePath = newPath;
      } catch (err) {
        toast.error("Failed to process image for saving.");
        return;
      }
    }

    if (!imagePath) {
      toast.error("Cannot save — no image path available.");
      return;
    }

    saveMutation.mutate(
      {
        imagePath,
        occasion,
        garmentIds: Array.from(selectedIds),
        bodyShape: bodyShape ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Look saved to your wardrobe.");
          tryOnMutation.reset();
          setSelectedIds(new Set());
          setOccasion(null);
          setDesiredLook("");
          setTab("gallery");
        },
      },
    );
  };

  const handleDeleteLook = (look: SavedLook) => {
    // Optimistic: clear detail view immediately
    setSelectedLook(null);
    // Remove shared tracking
    setSharedLookIds((prev) => {
      const next = new Set(prev);
      next.delete(look.id);
      return next;
    });
    deleteMutation.mutate(look);
  };

  const handleTryAnother = () => {
    tryOnMutation.reset();
    setSelectedIds(new Set());
    setOccasion(null);
    setDesiredLook("");
  };

  const handleShareToFeed = async () => {
    if (!selectedLook || !user) return;
    setIsSharing(true);
    try {
      // Download the look image from private "looks" bucket and re-upload to public "feed_images" bucket
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from("looks")
        .download(selectedLook.image_path);
      if (downloadError || !downloadData) throw new Error("Could not download look image");

      const feedPath = `${user.id}/${Date.now()}_shared.png`;
      const { error: uploadError } = await supabase.storage
        .from("feed_images")
        .upload(feedPath, downloadData, { contentType: "image/png" });
      if (uploadError) throw uploadError;

      // Get public URL for the feed_images bucket (public bucket)
      const { data: publicUrlData } = supabase.storage.from("feed_images").getPublicUrl(feedPath);
      const feedImageUrl = publicUrlData.publicUrl;

      const { error } = await supabase.from("feed_posts").insert({
        user_id: user.id,
        image_url: feedImageUrl,
        description: shareCaption.trim() || "AI Styled Look ✨",
        is_vton: true,
        status: "pending",
        outfit_breakdown: selectedLook.garment_ids
          ? selectedLook.garment_ids.map((id: string) => {
              const g = lookGarments.find((lg) => lg.id === id);
              return g
                ? { id: g.id, name: g.name || "Unnamed", category: g.category || "TOP", brand: g.brand || "", color: g.color || "" }
                : { id };
            })
          : [],
      } as any);
      if (error) throw error;

      setSharedLookIds((prev) => new Set(prev).add(selectedLook.id));
      setShareModalOpen(false);
      setShareCaption("");
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Look submitted for review!");
    } catch (err: any) {
      toast.error("Failed to share", { description: err.message });
    } finally {
      setIsSharing(false);
    }
  };

  // Empty state — default to locked until data resolves
  const isClosetLoading = !closetData;

  if (isClosetLoading) {
    return (
      <div className="pt-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasItems && tab === "tryon") {
    return (
      <div className="pt-6 space-y-5">
        <div className="flex items-center justify-between h-10">
          <h1 className="text-2xl font-bold text-foreground font-outfit">AI Stylist</h1>
          <Button
            variant="outline"
            size="icon"
            className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm relative"
            onClick={() => setChatOpen(true)}
          >
            <MessageCircle className="!w-6 !h-6 text-foreground stroke-[1]" />
          </Button>
        </div>
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md p-4 flex flex-col" onInteractOutside={ignoreToastInteractOutside}>
            <SheetTitle className="sr-only">Stylist Chat</SheetTitle>
            <StylistChat />
          </SheetContent>
        </Sheet>
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
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">AI Stylist</h1>
        <Button
          variant="outline"
          size="icon"
          className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm relative"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="!w-6 !h-6 text-foreground stroke-[1]" />
        </Button>
      </div>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-4 flex flex-col" onInteractOutside={ignoreToastInteractOutside}>
          <SheetTitle className="sr-only">Stylist Chat</SheetTitle>
          <StylistChat />
        </SheetContent>
      </Sheet>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setTab("tryon");
            setSelectedLook(null);
          }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            tab === "tryon" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Try On
        </button>
        <button
          onClick={() => setTab("gallery")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
            tab === "gallery" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
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
                <SafeImage
                  src={lookUrls[selectedLook.id]}
                  alt="Saved look"
                  aspectRatio="aspect-auto"
                  wrapperClassName="w-full rounded-2xl"
                  skeletonClassName="rounded-2xl"
                />
              </GlassCard>
              <div className="flex items-center justify-between mt-3">
                <div>
                  {selectedLook.occasion && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {selectedLook.occasion}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(selectedLook.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(() => {
                    const alreadyShared = sharedLookIds.has(selectedLook.id);
                    return (
                      <Button
                        variant={alreadyShared ? "default" : "secondary"}
                        size="sm"
                        className="rounded-xl gap-1.5"
                        disabled={alreadyShared}
                        onClick={() => {
                          setShareCaption("");
                          setShareModalOpen(true);
                        }}
                      >
                        {alreadyShared ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                        {alreadyShared ? "Shared to Feed" : "Share to Feed"}
                      </Button>
                    );
                  })()}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl gap-1.5"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDeleteLook(selectedLook)}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {/* Garment Details */}
              {lookGarments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Garments in this look
                  </p>
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
              {looks.map((look) => {
                if (!look || !lookUrls[look.id]) return null;
                return (
                  <GlassCard
                    key={look.id}
                    className="p-0 overflow-hidden cursor-pointer flex flex-col"
                    onClick={() => setSelectedLook(look)}
                  >
                    <div className="aspect-[3/4] bg-card w-full relative">
                      <SafeImage
                        src={lookUrls[look.id]}
                        alt="Saved look"
                        wrapperClassName="absolute inset-0 w-full h-full"
                        className="w-full h-full object-cover object-top"
                        aspectRatio=""
                        loading="lazy"
                      />
                      {look.is_public && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center shadow-sm">
                          <Globe className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 bg-card/50">
                      {look.occasion && <span className="text-[10px] font-medium text-primary">{look.occasion}</span>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(look.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========== SHARE TO FEED MODAL ========== */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl" onInteractOutside={ignoreToastInteractOutside}>
          <DialogHeader>
            <DialogTitle className="font-outfit">Publish to Feed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLook && (
              <div className="aspect-[3/4] w-full max-h-[280px] rounded-xl overflow-hidden bg-muted">
                <SafeImage
                  src={lookUrls[selectedLook.id]}
                  alt="Look preview"
                  wrapperClassName="w-full h-full"
                  className="w-full h-full object-cover object-top"
                  aspectRatio=""
                />
              </div>
            )}
            <Textarea
              placeholder="Add a caption…"
              value={shareCaption}
              onChange={(e) => setShareCaption(e.target.value)}
              className="rounded-xl resize-none border-border bg-card text-sm"
              rows={3}
            />
            <Button
              className="w-full rounded-xl gap-2"
              disabled={isSharing}
              onClick={handleShareToFeed}
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {isSharing ? "Posting…" : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {tab === "tryon" && (
        <>
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
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="p-0 overflow-hidden">
                  <div className="aspect-[3/4] w-full relative bg-card">
                    <SafeImage
                      src={tryOnMutation.data.image}
                      alt="Virtual try-on result"
                      wrapperClassName="absolute inset-0 w-full h-full rounded-2xl overflow-hidden"
                      className="w-full h-full object-cover object-top"
                      aspectRatio=""
                    />
                  </div>
                </GlassCard>
                <div className="flex gap-2 mt-3">
                  <Button
                    className="flex-1 rounded-xl gap-2"
                    disabled={saveMutation.isPending}
                    onClick={handleSaveLook}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Look
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={handleTryAnother}>
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
                    Select garments below and tap <span className="text-foreground font-medium">Try On</span> to see
                    yourself wearing them
                  </p>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Model toggle */}
          {!tryOnMutation.data && (
            <div className="mb-5">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Select Model
              </p>
              <div className="flex bg-card border border-border p-1 rounded-xl">
                <button
                  onClick={() => setUseVoraModel(false)}
                  disabled={!selfieUrl}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    !useVoraModel
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  } ${!selfieUrl ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <User className="w-3.5 h-3.5" />
                  My Selfie
                </button>
                <button
                  onClick={() => setUseVoraModel(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    useVoraModel
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Vora Model
                </button>
              </div>
              {!selfieUrl && (
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  *Upload a selfie in your Profile to unlock your personal model.
                </p>
              )}
            </div>
          )}

          {/* Occasion selector */}
          {!tryOnMutation.data && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Occasion (optional)
                </p>
                {!meetsThreshold && (
                  <span className="text-[10px] font-medium text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    Add {Math.max(0, MIN_TOPS - topsCount)} Tops, {Math.max(0, MIN_BOTTOMS - bottomsCount)} Bottoms to
                    unlock
                  </span>
                )}
              </div>
              <div
                className={`flex gap-2 overflow-x-auto no-scrollbar pb-1 ${!meetsThreshold ? "opacity-40 pointer-events-none grayscale" : ""}`}
              >
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    disabled={!meetsThreshold}
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

          {/* Style description */}
          {!tryOnMutation.data && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                How do you want to look? (Optional)
              </p>
              <Input
                value={desiredLook}
                onChange={(e) => setDesiredLook(e.target.value)}
                placeholder="Make it look edgy, streetwear style..."
                className="rounded-xl bg-card text-sm"
              />
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
                      className={`relative rounded-2xl overflow-hidden shadow-sm border-2 transition-all bg-[#FAF9F6] ${
                        isSelected ? "border-primary ring-1 ring-primary/30" : "border-black/5"
                      }`}
                    >
                      <div className="aspect-square w-full flex items-center justify-center bg-[#FAF9F6] p-2">
                        <SafeImage
                          src={imageUrls[item.id]}
                          alt={item.name || "Garment"}
                          wrapperClassName="w-full h-full"
                          aspectRatio=""
                          fit="contain"
                          loading="lazy"
                        />
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      {item.source === "dream" && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span className="text-[8px] font-semibold">Wishlist</span>
                        </div>
                      )}
                      <p className="text-[10px] text-[#6B6B6B] truncate px-1.5 py-1">{item.name || "Unnamed"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Try On button */}
          {!tryOnMutation.data && (
            <Button
              className="w-full rounded-xl gap-2 h-12 text-base transition-all"
              size="lg"
              disabled={
                tryOnMutation.isPending || (selectedIds.size === 0 && !occasion && !desiredLook.trim())
              }
              onClick={handleTryOn}
            >
              <Sparkles className="w-5 h-5" />
              {selectedIds.size > 0
                ? `Try On (${selectedIds.size} Items)`
                : occasion || desiredLook.trim()
                  ? "Style Me 🪄"
                  : "Select Items to Try On"}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default MirrorPage;
