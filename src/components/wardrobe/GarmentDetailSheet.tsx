import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import { Trash2, Droplets, SprayCan, Loader2, AlertTriangle, MapPin, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { GarmentDisplay } from "@/types/wardrobe";
import { useAuth } from "@/hooks/useAuth";
import { WardrobeMap } from "@/components/wardrobe/WardrobeMap";

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];
interface GarmentDetailSheetProps {
  item: GarmentDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onLocate?: (zoneId: string) => void;
  preloadedImageUrl?: string;
}

interface StainStep {
  step: number;
  title: string;
  description: string;
}

interface StainResult {
  steps: StainStep[];
  warning: string | null;
}

interface StoredCare {
  care?: { wash?: string; dry?: string; iron?: string; special?: string };
  stain_guide?: Array<{ stain: string; steps: string; warning: string | null }>;
}

const CARE_GUIDES: Record<string, { wash: string; dry: string; iron: string }> = {
  Cotton: {
    wash: "Machine wash warm (40°C). Separate whites from colors.",
    dry: "Tumble dry medium or line dry.",
    iron: "Iron on medium-high heat while slightly damp.",
  },
  Linen: {
    wash: "Machine wash cold or warm (30-40°C), gentle cycle.",
    dry: "Air dry flat to prevent wrinkles.",
    iron: "Iron on high heat while damp. Use steam.",
  },
  Silk: {
    wash: "Hand wash in cold water with mild detergent. No wringing.",
    dry: "Lay flat on a towel to dry. Avoid direct sunlight.",
    iron: "Iron on lowest setting, inside out. No steam.",
  },
  Wool: {
    wash: "Hand wash cold or machine wash on wool cycle. Use wool detergent.",
    dry: "Lay flat to dry. Never hang wet wool.",
    iron: "Steam or iron on low heat through a press cloth.",
  },
  Polyester: {
    wash: "Machine wash warm (40°C). Turn inside out.",
    dry: "Tumble dry low or hang dry.",
    iron: "Iron on low heat. Use a press cloth.",
  },
  Denim: {
    wash: "Machine wash cold, inside out. Wash infrequently.",
    dry: "Hang dry to preserve shape and color.",
    iron: "Iron on high heat while slightly damp.",
  },
  Leather: {
    wash: "Wipe with a damp cloth. Use leather cleaner for stains.",
    dry: "Air dry away from heat sources.",
    iron: "Do not iron. Use a steamer at a distance.",
  },
  Cashmere: {
    wash: "Hand wash cold with cashmere shampoo. Gently press water out.",
    dry: "Lay flat on a towel. Reshape while damp.",
    iron: "Steam gently or iron on lowest setting inside out.",
  },
};

const DEFAULT_CARE = {
  wash: "Check garment label. When in doubt, wash cold on gentle cycle.",
  dry: "Air dry or tumble dry low.",
  iron: "Iron on low heat with a press cloth.",
};

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
};

const GarmentDetailSheet = ({ item, open, onOpenChange, onDeleted, onLocate, preloadedImageUrl }: GarmentDetailSheetProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [showStain, setShowStain] = useState(false);
  const [stainType, setStainType] = useState("");
  const [stainLoading, setStainLoading] = useState(false);
  const [stainResult, setStainResult] = useState<StainResult | null>(null);
  const [isInLaundry, setIsInLaundry] = useState(false);
  const [laundryUpdating, setLaundryUpdating] = useState(false);
  const [closetSvg, setClosetSvg] = useState<string | null>(null);
  const [storageZoneId, setStorageZoneId] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editMaterial, setEditMaterial] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const isDream = item?.source === "dream";

  // Parse stored care data from notes (closet items only)
  const storedCare = useMemo<StoredCare | null>(() => {
    if (!item || isDream) return null;
    const notes = (item as GarmentDisplay & { source: "closet" }).notes;
    if (!notes) return null;
    try {
      return JSON.parse(notes) as StoredCare;
    } catch {
      return null;
    }
  }, [item, isDream]);

  useEffect(() => {
    if (!item) return;
    setImageUrl(null);
    setShowCare(false);
    setShowStain(false);
    setStainResult(null);
    setStainType("");
    setIsEditing(false);
    setIsInLaundry(!isDream ? ((item as any).is_in_laundry ?? false) : false);
    setStorageZoneId(!isDream ? ((item as any).storage_zone_id ?? null) : null);

    // Populate edit fields
    if (!isDream) {
      const ci = item as any;
      setEditName(ci.name || "");
      setEditCategory(ci.category || "");
      setEditColor(ci.color || "");
      setEditMaterial(ci.material || "");
      setEditBrand(ci.brand || "");
    }

    if (isDream) {
      setImageUrl(item.image_url);
    } else {
      supabase.storage
        .from("garments")
        .createSignedUrl(item.image_url, 3600)
        .then(({ data }) => setImageUrl(data?.signedUrl || null));
    }
  }, [item, isDream]);

  // Load closet SVG for zone display
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

  const invalidateCaches = async () => {
    await queryClient.invalidateQueries({ queryKey: ["closet"] });
    await queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    await queryClient.invalidateQueries({ queryKey: ["outfit-calendar-data"] });
  };

  const handleUpdateItem = async () => {
    if (!item || isDream) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("closet_items")
        .update({
          name: editName || null,
          category: editCategory || null,
          color: editColor || null,
          material: editMaterial || null,
          brand: editBrand || null,
        })
        .eq("id", item.id);

      if (error) throw error;

      await invalidateCaches();
      setIsEditing(false);
      toast.success("Item updated!");
      onDeleted(); // refresh parent
    } catch (err) {
      console.error("Edit error:", err);
      toast.error("Failed to update item.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleLaundry = async (checked: boolean) => {
    if (!item || isDream) return;
    setLaundryUpdating(true);
    try {
      const payload = checked
        ? { is_in_laundry: true, laundry_added_at: new Date().toISOString(), last_laundry_reminder_at: null }
        : { is_in_laundry: false, laundry_added_at: null, last_laundry_reminder_at: null };
      const { error } = await supabase.from("closet_items").update(payload).eq("id", item.id);
      if (error) throw error;
      setIsInLaundry(checked);
      toast.success(checked ? "Marked as in laundry" : "Back from laundry");
      await invalidateCaches();
      onDeleted();
    } catch {
      toast.error("Failed to update laundry status");
    } finally {
      setLaundryUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const confirmed = window.confirm("Are you sure you want to delete this item? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      if (isDream) {
        const { error } = await supabase.from("dream_items").delete().eq("id", item.id);
        if (error) throw error;
      } else {
        // Extract relative storage path from potential signed URL
        let storagePath = item.image_url;
        if (storagePath && storagePath.includes("/garments/")) {
          storagePath = storagePath.split("/garments/")[1].split("?")[0];
        }

        if (storagePath) {
          const { error: storageError } = await supabase.storage.from("garments").remove([storagePath]);
          if (storageError) {
            console.warn("Storage delete warning:", storageError);
          }
        }

        const { error } = await supabase.from("closet_items").delete().eq("id", item.id);
        if (error) throw error;
      }

      await invalidateCaches();
      if (isDream) {
        await queryClient.invalidateQueries({ queryKey: ["dream"] });
      }

      toast.success("Item removed");
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  const handleStainHelp = async () => {
    if (!stainType.trim() || !item || isDream) return;
    const closetItem = item as GarmentDisplay & { source: "closet" };
    setStainLoading(true);
    setStainResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("stain-help", {
        body: { material: closetItem.material, color: closetItem.color, stainType: stainType.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStainResult(data as StainResult);
    } catch (err) {
      console.error("Stain help error:", err);
      toast.error("Failed to get stain advice. Try again.");
    } finally {
      setStainLoading(false);
    }
  };

  if (!item) return null;

  // Care guide only for closet items
  const closetItem = !isDream ? (item as GarmentDisplay & { source: "closet" }) : null;
  const care = closetItem
    ? storedCare?.care
      ? {
          wash: storedCare.care.wash || DEFAULT_CARE.wash,
          dry: storedCare.care.dry || DEFAULT_CARE.dry,
          iron: storedCare.care.iron || DEFAULT_CARE.iron,
          special: storedCare.care.special || null,
        }
      : { ...(CARE_GUIDES[closetItem.material || ""] || DEFAULT_CARE), special: null as string | null }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto bg-background z-[60]">
        <SheetHeader>
          <SheetTitle className="font-outfit text-zinc-950 dark:text-zinc-50 font-bold tracking-tight opacity-100">
            {item.name || "Item Details"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-6">
          {imageUrl && (
            <SafeImage
              src={imageUrl}
              alt={item.name || "Garment"}
              wrapperClassName="w-full aspect-square rounded-2xl bg-[#F5F5F0] p-8"
              fit="contain"
              className="drop-shadow-md"
              skeletonClassName="rounded-2xl"
            />
          )}

          <div className="bg-card rounded-2xl px-4">
            {isDream ? (
              <>
                <DetailRow label="Brand" value={item.brand} />
                <DetailRow label="Price" value={item.price != null ? `$${item.price}` : null} />
                <DetailRow label="Added" value={new Date(item.created_at).toLocaleDateString()} />
              </>
            ) : isEditing ? (
              <div className="space-y-3 py-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm rounded-lg mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Category</Label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full h-8 text-sm rounded-lg bg-background border border-input px-2 mt-0.5 outline-none"
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Color</Label>
                  <Input
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 text-sm rounded-lg mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Material</Label>
                  <Input
                    value={editMaterial}
                    onChange={(e) => setEditMaterial(e.target.value)}
                    className="h-8 text-sm rounded-lg mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Brand</Label>
                  <Input
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="h-8 text-sm rounded-lg mt-0.5"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl gap-1"
                    onClick={handleUpdateItem}
                    disabled={editSaving}
                  >
                    {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl gap-1"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="w-3 h-3" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Category" value={closetItem!.category} />
                <DetailRow label="Color" value={closetItem!.color} />
                <DetailRow label="Material" value={closetItem!.material} />
                <DetailRow label="Brand" value={closetItem!.brand} />
                <DetailRow label="Added" value={new Date(item.created_at).toLocaleDateString()} />
              </>
            )}
          </div>

          {/* Edit & Locate buttons for closet items */}
          {!isDream && !isEditing && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4" /> Edit Details
              </Button>
              {storageZoneId && onLocate && (
                <Button
                  variant="outline"
                  className="rounded-xl gap-2"
                  onClick={() => {
                    onOpenChange(false);
                    onLocate(storageZoneId);
                  }}
                >
                  <MapPin className="w-4 h-4 text-foreground" /> Locate
                </Button>
              )}
            </div>
          )}

          {/* Wardrobe Map Zone */}
          {!isDream && closetSvg && storageZoneId && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 px-1">
                <MapPin className="w-3 h-3" /> Stored in: {storageZoneId.replace(/-/g, " ")}
              </p>
              <div className="relative w-full overflow-hidden rounded-xl bg-muted/30 aspect-[4/3]">
                <WardrobeMap svgString={closetSvg} activeZoneId={storageZoneId} preserveAspect />
              </div>
            </div>
          )}

          {!isDream && (
            <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3">
              <Label htmlFor="laundry-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                In Laundry
              </Label>
              <Switch
                id="laundry-toggle"
                checked={isInLaundry}
                onCheckedChange={handleToggleLaundry}
                disabled={laundryUpdating}
              />
            </div>
          )}

          {/* Action Buttons — closet items only */}
          {!isDream && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2"
                onClick={() => {
                  setShowCare(!showCare);
                  setShowStain(false);
                }}
              >
                <Droplets className="w-4 h-4 text-foreground" />
                Wash It
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2"
                onClick={() => {
                  setShowStain(!showStain);
                  setShowCare(false);
                }}
              >
                <SprayCan className="w-4 h-4 text-foreground" />
                Help Me Clean
              </Button>
            </div>
          )}

          {/* Wash It - Care Guide */}
          {!isDream && showCare && care && (
            <div className="bg-card rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" />
                Care Guide {closetItem!.material ? `for ${closetItem!.material}` : ""}
                {storedCare?.care && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                    AI
                  </span>
                )}
              </h3>
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Washing
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{care.wash}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Drying
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{care.dry}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Ironing
                  </span>
                  <p className="text-xs text-foreground mt-0.5">{care.iron}</p>
                </div>
                {care.special && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Special Notes
                    </span>
                    <p className="text-xs text-foreground mt-0.5">{care.special}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Help Me Clean - Stain section */}
          {!isDream && showStain && (
            <div className="bg-card rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <SprayCan className="w-4 h-4 text-primary" />
                Stain Removal
              </h3>

              {storedCare?.stain_guide && storedCare.stain_guide.length > 0 && (
                <div className="space-y-2.5 pb-2 border-b border-border">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                    Common stains for this item
                  </p>
                  {storedCare.stain_guide.map((sg, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{sg.stain.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{sg.stain}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sg.steps}</p>
                        {sg.warning && (
                          <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {sg.warning}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Ask AI about a specific stain
              </p>
              <div className="flex gap-2">
                <Input
                  value={stainType}
                  onChange={(e) => setStainType(e.target.value)}
                  placeholder="e.g. Coffee, Red wine, Grease..."
                  className="rounded-xl bg-background text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleStainHelp()}
                />
                <Button
                  size="sm"
                  className="rounded-xl shrink-0"
                  onClick={handleStainHelp}
                  disabled={!stainType.trim() || stainLoading}
                >
                  {stainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
                </Button>
              </div>

              {stainLoading && (
                <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs">Analyzing stain...</span>
                </div>
              )}

              {stainResult && (
                <div className="space-y-3">
                  {stainResult.steps.map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{s.step}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                      </div>
                    </div>
                  ))}
                  {stainResult.warning && (
                    <div className="flex gap-2 items-start bg-destructive/10 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{stainResult.warning}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="w-full rounded-xl">
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? "Removing..." : isDream ? "Remove from Wishlist" : "Remove from Wardrobe"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GarmentDetailSheet;
