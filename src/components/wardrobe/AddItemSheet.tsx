import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Sparkles, Search, RefreshCw, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeToPng } from "@/utils/imageProcessing";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { WardrobeMap } from "@/components/wardrobe/WardrobeMap";

export interface PrefillData {
  imageFile: File;
  preview: string;
  name: string;
  category: string;
  color: string;
  material: string;
  brand: string;
  hasTransparentBg?: boolean;
  /** Processed blob after bg removal (for manual uploads) */
  processedBlob?: Blob;
}

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
  prefill?: PrefillData | null;
}

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];

const AddItemSheet = ({ open, onOpenChange, onItemAdded, prefill }: AddItemSheetProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasTransparentBg, setHasTransparentBg] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [careData, setCareData] = useState<any>(null);

  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = () => {
    setFile(null);
    setProcessedBlob(null);
    setPreview(null);
    setHasTransparentBg(false);
    setName("");
    setCategory("");
    setColor("");
    setMaterial("");
    setBrand("");
    setCareData(null);
    setIsProcessingAI(false);
  };

  const imageBase64Ref = useRef<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    // Show raw preview immediately
    const rawPreview = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target?.result as string);
      r.readAsDataURL(f);
    });
    setPreview(rawPreview);

    // Step 1: AI flat-lay generation + background removal via Edge Function
    setIsProcessingAI(true);
    let finalBlob: Blob = f;
    let bgRemoved = false;
    try {
      const normalizedBlob = await normalizeToPng(f);
      const normalizedFile = new File([normalizedBlob], "normalized.png", { type: "image/png" });

      const formData = new FormData();
      formData.append("image_file", normalizedFile);

      // Bypass supabase.functions.invoke to avoid binary response corruption
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/process-garment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 402) {
          toast.info("AI flat-lay unavailable (quota reached). Using original photo.");
          throw new Error("QUOTA_EXCEEDED");
        }
        const errorText = await response.text();
        throw new Error(`AI Processing Error: ${errorText}`);
      }

      const safeBlob = await response.blob();

      if (safeBlob.size === 0) {
        throw new Error("AI returned an empty image.");
      }

      const processedFile = new File([safeBlob], `processed_${Date.now()}.png`, { type: "image/png" });
      finalBlob = processedFile;
      bgRemoved = true;
      setHasTransparentBg(true);
      setProcessedBlob(processedFile);

      const processedPreview = URL.createObjectURL(processedFile);
      setPreview(processedPreview);
    } catch (err: any) {
      console.error("AI Processing Error:", err);
      if (err.message !== "QUOTA_EXCEEDED") {
        toast.error(`AI Processing Failed: ${err.message || "Unknown error occurred"}`);
      }
      setProcessedBlob(null);
      setHasTransparentBg(false);
    } finally {
      setIsProcessingAI(false);
    }

    // Store base64 of the ORIGINAL image for AI tagging / product lookup
    // (original has better context: colors, brand logos, fabric texture)
    const normalizedForTagging = await normalizeToPng(f);
    const base64 = await new Promise<string>((resolve) => {
      const b64Reader = new FileReader();
      b64Reader.onload = (ev) => {
        const result = ev.target?.result as string;
        resolve(result.split(",")[1]);
      };
      b64Reader.readAsDataURL(normalizedForTagging);
    });
    imageBase64Ref.current = base64;

    // Step 2: Auto-tag with AI
    setTagging(true);
    try {
      const { data, error } = await supabase.functions.invoke("tag-garment", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (data?.name) setName(data.name);
      if (data?.category) setCategory(data.category);
      if (data?.color) setColor(data.color);
      if (data?.material) setMaterial(data.material);
      if (data?.brand) setBrand(data.brand || "");
      toast.success(bgRemoved ? "Background removed & AI tagged! ✨" : "AI tagged your item! ✨");

      if (data?.brand) {
        triggerProductLookup(base64, data.brand, data.name, data.category, data.color, data.material);
      }
    } catch (err) {
      console.error("AI tagging error:", err);
      toast.error("AI tagging failed. Fill in details manually.");
    } finally {
      setTagging(false);
    }
  };

  const triggerProductLookup = async (
    base64: string | null,
    brandVal: string,
    nameVal?: string,
    categoryVal?: string,
    colorVal?: string,
    materialVal?: string
  ) => {
    if (!brandVal.trim() || !base64) return;
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-lookup", {
        body: {
          imageBase64: base64,
          brand: brandVal,
          name: nameVal || name,
          category: categoryVal || category,
          color: colorVal || color,
          material: materialVal || material,
        },
      });

      if (error) throw error;

      if (data?.name) setName(data.name);
      if (data?.material) setMaterial(data.material);
      if (data?.care || data?.stain_guide) {
        setCareData({ care: data.care, stain_guide: data.stain_guide });
        toast.success("Product identified! Care info loaded 🧺");
      }
    } catch (err) {
      console.error("Product lookup error:", err);
    } finally {
      setLookingUp(false);
    }
  };

  // Debounced brand lookup
  const handleBrandChange = (val: string) => {
    setBrand(val);
    if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
    if (val.trim().length >= 2 && imageBase64Ref.current) {
      brandTimerRef.current = setTimeout(() => {
        triggerProductLookup(imageBase64Ref.current, val);
      }, 1200);
    }
  };

  useEffect(() => {
    return () => {
      if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
    };
  }, []);

  // Apply prefill data from SmartCamera
  useEffect(() => {
    if (prefill && open) {
      setFile(prefill.imageFile);
      setPreview(prefill.preview);
      setName(prefill.name);
      setCategory(prefill.category);
      setColor(prefill.color);
      setMaterial(prefill.material);
      setBrand(prefill.brand);
      setHasTransparentBg(!!prefill.hasTransparentBg);
      if (prefill.processedBlob) setProcessedBlob(prefill.processedBlob);
    }
  }, [prefill, open]);

  const handleSave = async () => {
    if (!user || !file) return;
    setSaving(true);

    try {
      // Use processed blob (bg-removed + cropped) if available, otherwise original
      const uploadBlob: Blob = processedBlob || file;
      const ext = hasTransparentBg || processedBlob ? "png" : file.name.split(".").pop() || "jpg";
      const contentType = hasTransparentBg || processedBlob ? "image/png" : file.type;
      const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("garments")
        .upload(filePath, uploadBlob, { contentType });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("closet_items").insert({
        user_id: user.id,
        image_url: filePath,
        name: name || "Unnamed Item",
        category: category || null,
        color: color || null,
        material: material || null,
        brand: brand || null,
        notes: careData ? JSON.stringify(careData) : null,
      });

      if (dbError) throw dbError;

      toast.success("Item added to your wardrobe!");
      resetForm();
      onOpenChange(false);
      onItemAdded();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[90vh] overflow-y-auto bg-background"
        onInteractOutside={(e) => {
          const isToast = (e.target as Element).closest('[data-sonner-toast]');
          if (isToast) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle className="font-outfit">Add to Wardrobe</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4 pb-6">
          {/* Photo Upload */}
          {preview ? (
            <div className={`relative w-full aspect-square rounded-2xl overflow-hidden ${hasTransparentBg ? "bg-product-bg p-[12%]" : "bg-card"}`}>
              <img
                src={preview}
                alt="Item preview"
                className={`w-full h-full ${hasTransparentBg ? "object-contain" : "object-cover"}`}
                style={hasTransparentBg ? { filter: "drop-shadow(0px 10px 15px rgba(0,0,0,0.1))" } : undefined}
              />
              {!(isProcessingAI || tagging) && (
                <label className="absolute bottom-3 right-3 bg-background/90 backdrop-blur shadow-sm text-foreground px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer flex items-center gap-1.5 hover:bg-background transition-colors z-10 border border-border">
                  <RefreshCw className="w-3 h-3" />
                  Replace
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              )}
              {(isProcessingAI || tagging) && (
                <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-2 z-20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm font-medium text-foreground flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" /> {isProcessingAI ? "AI is generating your flat-lay…" : "AI is tagging..."}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-border bg-card cursor-pointer">
              <Camera className="w-10 h-10 text-muted-foreground" />
              <span className="text-sm font-medium text-primary">Upload garment photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Navy Polo Shirt" className="mt-1 rounded-xl bg-card" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      category === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground border border-border"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Navy Blue" className="mt-1 rounded-xl bg-card" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Cotton" className="mt-1 rounded-xl bg-card" />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Brand</Label>
              <div className="relative">
                <Input
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  placeholder="e.g. Ralph Lauren"
                  className="mt-1 rounded-xl bg-card pr-10"
                />
                {lookingUp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                )}
              </div>
              {lookingUp && (
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Search className="w-3 h-3" /> Searching product info...
                </p>
              )}
            </div>

            {/* Care data preview */}
            {careData?.care && (
              <div className="bg-card rounded-2xl p-3 space-y-1.5 border border-primary/20">
                <p className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Care info loaded
                </p>
                <p className="text-xs text-muted-foreground">{careData.care.wash}</p>
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={!file || saving} className="w-full rounded-xl">
            {saving ? "Saving..." : "Add to Wardrobe"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddItemSheet;
