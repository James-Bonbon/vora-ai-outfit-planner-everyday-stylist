import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Sparkles, Search, RefreshCw, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeToPng, sliceImageByBoundingBoxes, BoundingBox, CroppedGarment } from "@/utils/imageProcessing";
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
  const [storageZoneId, setStorageZoneId] = useState<string | null>(null);
  const [closetSvg, setClosetSvg] = useState<string | null>(null);
  const [showMapStep, setShowMapStep] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<CroppedGarment[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  interface BatchEditItem {
    id: number;
    blob: Blob;
    preview: string;
    category: string;
    name: string;
  }
  const [batchEdits, setBatchEdits] = useState<BatchEditItem[]>([]);

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
    setStorageZoneId(null);
    setShowMapStep(false);
    setSavedItemId(null);
    setIsBatchMode(false);
    setBatchItems([]);

    // Destroy object URLs to prevent RAM leaks
    batchEdits.forEach(item => {
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    setBatchEdits([]);

    setBatchProgress({ current: 0, total: 0 });
  };

  const imageBase64Ref = useRef<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    resetForm();
    setFile(f);

    const rawPreview = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target?.result as string);
      r.readAsDataURL(f);
    });
    setPreview(rawPreview);

    setIsProcessingAI(true);

    try {
      // 1. Get Base64 for the Surveyor
      const normalizedBlob = await normalizeToPng(f);
      const base64 = await new Promise<string>((resolve) => {
        const b64Reader = new FileReader();
        b64Reader.onload = (ev) => resolve((ev.target?.result as string).split(",")[1]);
        b64Reader.readAsDataURL(normalizedBlob);
      });
      imageBase64Ref.current = base64;

      // 2. Call the Traffic Cop (Surveyor)
      const { data: detectData, error: detectError } = await supabase.functions.invoke("detect-garments", {
        body: { imageBase64: base64, mimeType: "image/png" },
      });

      if (detectError) throw detectError;
      const boxes: BoundingBox[] = detectData || [];

      // 3. Routing Logic
      if (boxes.length > 1) {
        // --- BATCH FLOW ---
        setIsBatchMode(true);
        setBatchProgress({ current: 0, total: boxes.length });

        const slicedGarments = await sliceImageByBoundingBoxes(f, boxes);
        const processedBatch: CroppedGarment[] = [];

        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        for (let i = 0; i < slicedGarments.length; i++) {
          setBatchProgress({ current: i + 1, total: boxes.length });
          const item = slicedGarments[i];

          const formData = new FormData();
          const itemFile = new File([item.blob], `slice_${i}.png`, { type: "image/png" });
          formData.append("image_file", itemFile);

          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/process-garment`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session?.access_token}` },
              body: formData,
            });

            if (response.ok) {
              const bgRemovedBlob = await response.blob();
              processedBatch.push({ blob: bgRemovedBlob, category: item.category });
            } else {
              processedBatch.push(item);
            }
          } catch (err) {
            processedBatch.push(item);
          }
        }

        setBatchItems(processedBatch);
        
        const editableItems: BatchEditItem[] = processedBatch.map((item, idx) => ({
          id: idx,
          blob: item.blob,
          preview: URL.createObjectURL(item.blob),
          category: item.category || "Tops",
          name: `${item.category || 'Item'} ${idx + 1}`
        }));
        setBatchEdits(editableItems);
        
        setIsProcessingAI(false);
        toast.success(`Successfully processed ${processedBatch.length} items! Review and save.`);
        return;
      }

      // --- SINGLE ITEM FLOW ---
      setIsBatchMode(false);

      // AI flat-lay generation + background removal
      let finalBlob: Blob = f;
      let bgRemoved = false;

      const normalizedFile = new File([normalizedBlob], "normalized.png", { type: "image/png" });
      const formData = new FormData();
      formData.append("image_file", normalizedFile);

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/process-garment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
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

    // Step 2: Auto-tag with AI
    setTagging(true);
    try {
      const base64 = imageBase64Ref.current;
      const { data, error } = await supabase.functions.invoke("tag-garment", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (data?.name) setName(data.name);
      if (data?.category) setCategory(data.category);
      if (data?.color) setColor(data.color);
      if (data?.material) setMaterial(data.material);
      if (data?.brand) setBrand(data.brand || "");
      toast.success("AI tagged your item! ✨");

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

  // Load closet SVG for zone selection
  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from("profiles")
      .select("closet_svg")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.closet_svg) setClosetSvg(data.closet_svg);
      });
  }, [user, open]);

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

      const { data: insertData, error: dbError } = await supabase.from("closet_items").insert({
        user_id: user.id,
        image_url: filePath,
        name: name || "Unnamed Item",
        category: category || null,
        color: color || null,
        material: material || null,
        brand: brand || null,
        notes: careData ? JSON.stringify(careData) : null,
        storage_zone_id: storageZoneId,
      }).select("id").single();

      if (dbError) throw dbError;

      toast.success("Item added to your wardrobe!");

      // If user has a closet map, show zone selection step
      if (closetSvg && insertData?.id) {
        setSavedItemId(insertData.id);
        setShowMapStep(true);
      } else {
        resetForm();
        onOpenChange(false);
        onItemAdded();
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const handleZoneSelect = async (zoneId: string) => {
    setStorageZoneId(zoneId);
    if (savedItemId) {
      await supabase
        .from("closet_items")
        .update({ storage_zone_id: zoneId })
        .eq("id", savedItemId);
      toast.success(`Mapped to "${zoneId}" zone!`);
    }
    resetForm();
    onOpenChange(false);
    onItemAdded();
  };

  const handleBatchSave = async () => {
    if (!user || batchEdits.length === 0) return;
    setSaving(true);

    try {
      const insertPayloads = [];

      for (const item of batchEdits) {
        const ext = "png"; 
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("garments")
          .upload(filePath, item.blob, { contentType: "image/png" });

        if (uploadError) throw uploadError;

        insertPayloads.push({
          user_id: user.id,
          image_url: filePath,
          name: item.name,
          category: item.category,
          storage_zone_id: storageZoneId || null,
        });
      }

      const { error: dbError } = await supabase.from("closet_items").insert(insertPayloads);
      if (dbError) throw dbError;

      toast.success(`Added ${batchEdits.length} items to your wardrobe!`);
      resetForm();
      onOpenChange(false);
      if (onItemAdded) onItemAdded();
    } catch (err) {
      console.error("Batch save error:", err);
      toast.error("Failed to save batch items. Please try again.");
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
          <SheetTitle className="font-outfit">
            {showMapStep ? "Where does it live?" : "Add to Wardrobe"}
          </SheetTitle>
        </SheetHeader>

        {showMapStep && closetSvg ? (
          <div className="space-y-4 mt-4 pb-6">
            <p className="text-sm text-muted-foreground text-center">
              Tap the compartment where you store this item
            </p>
            <WardrobeMap
              svgString={closetSvg}
              isSelectionMode
              activeZoneId={storageZoneId || undefined}
              onZoneSelect={handleZoneSelect}
            />
            <Button
              variant="ghost"
              className="w-full rounded-xl text-muted-foreground"
              onClick={() => {
                resetForm();
                onOpenChange(false);
                onItemAdded();
              }}
            >
              Skip
            </Button>
          </div>
        ) : (
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
                    <Sparkles className="w-4 h-4 text-primary" /> {isProcessingAI ? (isBatchMode ? `Processing item ${batchProgress.current} of ${batchProgress.total}...` : "AI is generating your flat-lay…") : "AI is tagging..."}
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

          {/* Form Fields Routing */}
          {isBatchMode && batchEdits.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold font-outfit text-foreground">Review Batch Items</h3>
                <span className="text-xs text-muted-foreground">{batchEdits.length} items</span>
              </div>
              
              <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-2">
                {batchEdits.map((item, index) => (
                  <div key={item.id} className="flex gap-4 p-3 rounded-2xl bg-card border border-border">
                    <div className="w-20 h-24 shrink-0 rounded-xl bg-muted overflow-hidden flex items-center justify-center p-2">
                      <img src={item.preview} alt={item.name} className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Name</Label>
                        <Input 
                          value={item.name} 
                          onChange={(e) => {
                            const newEdits = [...batchEdits];
                            newEdits[index].name = e.target.value;
                            setBatchEdits(newEdits);
                          }} 
                          className="h-7 text-xs rounded-lg mt-0.5" 
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Category</Label>
                        <select 
                          value={item.category}
                          onChange={(e) => {
                            const newEdits = [...batchEdits];
                            newEdits[index].category = e.target.value;
                            setBatchEdits(newEdits);
                          }}
                          className="w-full h-7 text-xs rounded-lg bg-background border border-input px-2 mt-0.5 outline-none"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={handleBatchSave} disabled={saving} className="w-full rounded-xl mt-4">
                {saving ? "Saving All..." : `Save ${batchEdits.length} Items to Wardrobe`}
              </Button>
            </div>
          ) : (
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

              <Button onClick={handleSave} disabled={!file || saving} className="w-full rounded-xl">
                {saving ? "Saving..." : "Add to Wardrobe"}
              </Button>
            </div>
          )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AddItemSheet;
