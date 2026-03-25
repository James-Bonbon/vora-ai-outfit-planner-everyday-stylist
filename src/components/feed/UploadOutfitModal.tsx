import { useState, useRef, useCallback } from "react";
import { X, ImagePlus, Sparkles, Loader2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Garment, OutfitPost } from "@/data/mockFeedData";

interface UploadOutfitModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: (post: OutfitPost) => void;
  username: string;
}

const CATEGORY_OPTIONS: Garment["category"][] = ["OUT", "TOP", "BOT", "SHOE", "ACC"];
const CATEGORY_LABELS: Record<string, string> = {
  OUT: "Outerwear",
  TOP: "Top",
  BOT: "Bottom",
  SHOE: "Shoes",
  ACC: "Accessory",
};

export const UploadOutfitModal = ({ open, onClose, onPublish, username }: UploadOutfitModalProps) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isTagging, setIsTagging] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setImagePreview(null);
    setImageFile(null);
    setDescription("");
    setGarments([]);
    setIsTagging(false);
    setIsPublishing(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const autoTagWithAI = async () => {
    if (!imagePreview) return;
    setIsTagging(true);
    try {
      // Extract base64 data from data URL
      const base64 = imagePreview.split(",")[1];
      const { data, error } = await supabase.functions.invoke("tag-outfit", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.garments && Array.isArray(data.garments)) {
        const tagged: Garment[] = data.garments.map((g: any, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          category: mapCategory(g.category),
          name: g.name || "Unknown Item",
          brand: g.brand || "Unbranded",
          flat_lay_image_url: "",
        }));
        setGarments(tagged);
        toast.success("AI tagged your outfit!");
      } else {
        toast.error("AI couldn't identify garments. Try adding manually.");
      }
    } catch (err: any) {
      console.error("Auto-tag error:", err);
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("Rate limited — please try again shortly.");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("AI credits exhausted. Please add funds.");
      } else {
        toast.error("Auto-tag failed. Try adding garments manually.");
      }
    } finally {
      setIsTagging(false);
    }
  };

  const mapCategory = (cat: string): Garment["category"] => {
    const c = (cat || "").toUpperCase();
    if (c.includes("OUTER") || c.includes("COAT") || c.includes("JACKET")) return "OUT";
    if (c.includes("TOP") || c.includes("SHIRT") || c.includes("BLOUSE") || c.includes("TEE") || c.includes("SWEATER")) return "TOP";
    if (c.includes("BOT") || c.includes("PANT") || c.includes("TROUSER") || c.includes("SKIRT") || c.includes("SHORT") || c.includes("JEAN")) return "BOT";
    if (c.includes("SHOE") || c.includes("BOOT") || c.includes("SNEAKER") || c.includes("SANDAL") || c.includes("HEEL")) return "SHOE";
    if (c.includes("ACC") || c.includes("BAG") || c.includes("HAT") || c.includes("SCARF") || c.includes("JEWEL") || c.includes("WATCH") || c.includes("BELT") || c.includes("SUNGLASS")) return "ACC";
    return "TOP";
  };

  const addEmptyGarment = () => {
    setGarments((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, category: "TOP", name: "", brand: "", flat_lay_image_url: "" },
    ]);
  };

  const updateGarment = (id: string, field: keyof Garment, value: string) => {
    setGarments((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const removeGarment = (id: string) => {
    setGarments((prev) => prev.filter((g) => g.id !== id));
  };

  const handlePublish = async () => {
    if (!imagePreview) { toast.error("Please add an outfit photo."); return; }
    if (!description.trim()) { toast.error("Please add a description."); return; }
    if (garments.length === 0) { toast.error("Tag at least one garment."); return; }

    setIsPublishing(true);
    try {
      const post: OutfitPost = {
        id: `user-${Date.now()}`,
        username: username || "@you",
        main_image_url: imagePreview,
        description: description.trim(),
        likesCount: 0,
        isLiked: false,
        outfit_breakdown: garments.map((g) => ({
          ...g,
          name: g.name || "Unnamed Item",
          brand: g.brand || "Unbranded",
        })),
      };
      onPublish(post);
      toast.success("Outfit published to VORA.");
      handleClose();
    } catch {
      toast.error("Failed to publish. Try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-sm font-semibold tracking-wide text-foreground font-outfit">New Outfit</h2>
        <div className="w-8" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Image Dropzone */}
        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="aspect-[4/5] rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ImagePlus className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Add your outfit photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap to upload or drag & drop</p>
            </div>
          </div>
        ) : (
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-muted">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => { setImagePreview(null); setImageFile(null); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Weekend uniform in the city…"
            className="resize-none bg-muted/30 border-border/40 rounded-xl text-sm min-h-[72px]"
            maxLength={200}
          />
          <p className="text-[10px] text-muted-foreground text-right">{description.length}/200</p>
        </div>

        {/* AI Auto-Tag */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Garments</label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={addEmptyGarment} className="h-7 px-2.5 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add
              </Button>
              {imagePreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoTagWithAI}
                  disabled={isTagging}
                  className="h-7 px-3 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  {isTagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isTagging ? "Analyzing…" : "Auto-Tag with AI"}
                </Button>
              )}
            </div>
          </div>

          {garments.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-muted-foreground">No garments tagged yet.</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Use AI to auto-detect or add manually.
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            {garments.map((g) => (
              <div key={g.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/30">
                {/* Category selector */}
                <select
                  value={g.category}
                  onChange={(e) => updateGarment(g.id, "category", e.target.value)}
                  className="w-20 shrink-0 text-[10px] font-semibold uppercase bg-secondary text-secondary-foreground rounded-md px-2 py-1.5 border-none outline-none"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={g.name}
                    onChange={(e) => updateGarment(g.id, "name", e.target.value)}
                    placeholder="Item name"
                    className="h-7 text-xs bg-transparent border-border/30"
                  />
                  <Input
                    value={g.brand}
                    onChange={(e) => updateGarment(g.id, "brand", e.target.value)}
                    placeholder="Brand"
                    className="h-7 text-xs bg-transparent border-border/30"
                  />
                </div>
                <button onClick={() => removeGarment(g.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors mt-1">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/50">
        <Button
          onClick={handlePublish}
          disabled={isPublishing || !imagePreview || !description.trim() || garments.length === 0}
          className="w-full h-11 rounded-xl text-sm font-semibold"
        >
          {isPublishing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Publish to Feed
        </Button>
      </div>
    </div>
  );
};
