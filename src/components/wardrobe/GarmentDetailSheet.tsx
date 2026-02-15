import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2, Droplets, SprayCan, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface GarmentItem {
  id: string;
  image_url: string;
  name: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
  created_at: string;
}

interface GarmentDetailSheetProps {
  item: GarmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
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

const CARE_GUIDES: Record<string, { wash: string; dry: string; iron: string }> = {
  Cotton: { wash: "Machine wash warm (40°C). Separate whites from colors.", dry: "Tumble dry medium or line dry.", iron: "Iron on medium-high heat while slightly damp." },
  Linen: { wash: "Machine wash cold or warm (30-40°C), gentle cycle.", dry: "Air dry flat to prevent wrinkles.", iron: "Iron on high heat while damp. Use steam." },
  Silk: { wash: "Hand wash in cold water with mild detergent. No wringing.", dry: "Lay flat on a towel to dry. Avoid direct sunlight.", iron: "Iron on lowest setting, inside out. No steam." },
  Wool: { wash: "Hand wash cold or machine wash on wool cycle. Use wool detergent.", dry: "Lay flat to dry. Never hang wet wool.", iron: "Steam or iron on low heat through a press cloth." },
  Polyester: { wash: "Machine wash warm (40°C). Turn inside out.", dry: "Tumble dry low or hang dry.", iron: "Iron on low heat. Use a press cloth." },
  Denim: { wash: "Machine wash cold, inside out. Wash infrequently.", dry: "Hang dry to preserve shape and color.", iron: "Iron on high heat while slightly damp." },
  Leather: { wash: "Wipe with a damp cloth. Use leather cleaner for stains.", dry: "Air dry away from heat sources.", iron: "Do not iron. Use a steamer at a distance." },
  Cashmere: { wash: "Hand wash cold with cashmere shampoo. Gently press water out.", dry: "Lay flat on a towel. Reshape while damp.", iron: "Steam gently or iron on lowest setting inside out." },
};

const DEFAULT_CARE = { wash: "Check garment label. When in doubt, wash cold on gentle cycle.", dry: "Air dry or tumble dry low.", iron: "Iron on low heat with a press cloth." };

const DetailRow = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
};

const GarmentDetailSheet = ({ item, open, onOpenChange, onDeleted }: GarmentDetailSheetProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCare, setShowCare] = useState(false);
  const [showStain, setShowStain] = useState(false);
  const [stainType, setStainType] = useState("");
  const [stainLoading, setStainLoading] = useState(false);
  const [stainResult, setStainResult] = useState<StainResult | null>(null);

  useEffect(() => {
    if (!item) return;
    setShowCare(false);
    setShowStain(false);
    setStainResult(null);
    setStainType("");
    supabase.storage
      .from("garments")
      .createSignedUrl(item.image_url, 3600)
      .then(({ data }) => setImageUrl(data?.signedUrl || null));
  }, [item]);

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await supabase.storage.from("garments").remove([item.image_url]);
      const { error } = await supabase.from("closet_items").delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Item removed");
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  const handleStainHelp = async () => {
    if (!stainType.trim() || !item) return;
    setStainLoading(true);
    setStainResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("stain-help", {
        body: { material: item.material, color: item.color, stainType: stainType.trim() },
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

  const care = CARE_GUIDES[item.material || ""] || DEFAULT_CARE;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-outfit">{item.name || "Item Details"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-6">
          {imageUrl && (
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-card">
              <img src={imageUrl} alt={item.name || "Garment"} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="bg-card rounded-2xl px-4">
            <DetailRow label="Category" value={item.category} />
            <DetailRow label="Color" value={item.color} />
            <DetailRow label="Material" value={item.material} />
            <DetailRow label="Brand" value={item.brand} />
            <DetailRow label="Added" value={new Date(item.created_at).toLocaleDateString()} />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl gap-2"
              onClick={() => { setShowCare(!showCare); setShowStain(false); }}
            >
              <Droplets className="w-4 h-4 text-primary" />
              Wash It
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl gap-2"
              onClick={() => { setShowStain(!showStain); setShowCare(false); }}
            >
              <SprayCan className="w-4 h-4 text-primary" />
              Help Me Clean
            </Button>
          </div>

          {/* Wash It - Care Guide */}
          {showCare && (
            <div className="bg-card rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" />
                Care Guide {item.material ? `for ${item.material}` : ""}
              </h3>
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Washing</span>
                  <p className="text-xs text-foreground mt-0.5">{care.wash}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Drying</span>
                  <p className="text-xs text-foreground mt-0.5">{care.dry}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ironing</span>
                  <p className="text-xs text-foreground mt-0.5">{care.iron}</p>
                </div>
              </div>
            </div>
          )}

          {/* Help Me Clean - Stain Removal */}
          {showStain && (
            <div className="bg-card rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <SprayCan className="w-4 h-4 text-primary" />
                AI Stain Removal
              </h3>
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

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full rounded-xl"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? "Removing..." : "Remove from Wardrobe"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GarmentDetailSheet;
