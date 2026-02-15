import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AddItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
}

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];

const AddItemSheet = ({ open, onOpenChange, onItemAdded }: AddItemSheetProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setName("");
    setCategory("");
    setColor("");
    setMaterial("");
    setBrand("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);

    // Auto-tag with AI
    setTagging(true);
    try {
      const base64Reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        base64Reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        base64Reader.readAsDataURL(f);
      });

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
    } catch (err) {
      console.error("AI tagging error:", err);
      toast.error("AI tagging failed. Fill in details manually.");
    } finally {
      setTagging(false);
    }
  };

  const handleSave = async () => {
    if (!user || !file) return;
    setSaving(true);

    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("garments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("closet_items").insert({
        user_id: user.id,
        image_url: filePath,
        name: name || "Unnamed Item",
        category: category || null,
        color: color || null,
        material: material || null,
        brand: brand || null,
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
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-outfit">Add to Wardrobe</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4 pb-6">
          {/* Photo Upload */}
          {preview ? (
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-card">
              <img src={preview} alt="Item preview" className="w-full h-full object-cover" />
              {tagging && (
                <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm font-medium text-foreground flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" /> AI is tagging...
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
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Ralph Lauren" className="mt-1 rounded-xl bg-card" />
            </div>
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
