import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Plus, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";
import { generateSmartOutfit } from "@/utils/stylingEngine";
import type { ClosetItem } from "@/types/wardrobe";

export const LookbookTab = ({ items, imageUrls }: { items: ClosetItem[]; imageUrls: Record<string, string> }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outfitName, setOutfitName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: outfits = [], isLoading } = useQuery({
    queryKey: ["lookbook", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lookbook_outfits")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lookbook_outfits").insert({
        user_id: user!.id,
        name: outfitName || "My Outfit",
        garment_ids: Array.from(selectedIds),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookbook"] });
      toast.success("Outfit saved to Lookbook!");
      setDrawerOpen(false);
      setOutfitName("");
      setSelectedIds(new Set());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("lookbook_outfits").delete().eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lookbook"] }),
  });

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      else toast.error("Max 4 items per outfit");
      return next;
    });
  };

  const handleAISuggest = () => {
    const pool = items.map((item) => ({
      ...item,
      image_url: imageUrls[item.id] || item.image_url,
      source: "closet" as const,
    }));
    const suggested = generateSmartOutfit(pool as any, new Date(), null);
    if (suggested && suggested.length > 0) {
      setSelectedIds(new Set(suggested.map((g) => g.id)));
      toast.success("AI suggested an outfit!");
    } else {
      toast.error("Not enough items in your closet to auto-suggest.");
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Button className="w-full rounded-xl gap-2" onClick={() => setDrawerOpen(true)}>
        <Plus className="w-4 h-4" /> Design New Outfit
      </Button>

      {outfits.length === 0 ? (
        <GlassCard className="flex flex-col items-center py-16 text-center">
          <Sparkles className="w-10 h-10 text-primary mb-4" />
          <h3 className="font-semibold text-foreground">Your lookbook is empty.</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Combine your closet items into ready-to-wear outfits.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {outfits.map((outfit: any) => {
            const outfitGarments = outfit.garment_ids
              .map((id: string) => items.find((i) => i.id === id))
              .filter(Boolean);
            const garmentsWithUrls = outfitGarments.map((g: any) => ({
              ...g,
              image_url: imageUrls[g.id] || g.image_url,
            }));

            return (
              <GlassCard key={outfit.id}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-sm">{outfit.name}</h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => deleteMutation.mutate(outfit.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                {garmentsWithUrls.length > 0 ? (
                  <OutfitCollage garments={garmentsWithUrls} />
                ) : (
                  <p className="text-xs text-muted-foreground">Items no longer in closet.</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Design Outfit</DrawerTitle>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleAISuggest}>
              <Wand2 className="w-4 h-4" /> AI Auto-Fill
            </Button>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            <Input
              placeholder="Outfit name (e.g. Sunday Brunch)"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              className="rounded-xl bg-muted"
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Select Items ({selectedIds.size}/4)
              </p>
              <div className="grid grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto">
                {items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`relative rounded-xl overflow-hidden border-2 p-1 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 scale-[0.98]"
                          : "border-transparent bg-muted"
                      }`}
                    >
                      <div className="aspect-square">
                        <SafeImage src={imageUrls[item.id]} alt={item.name || "Item"} fit="contain" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full rounded-xl"
              disabled={selectedIds.size === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save to Lookbook"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
