import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!item) return;
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

  if (!item) return null;

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
