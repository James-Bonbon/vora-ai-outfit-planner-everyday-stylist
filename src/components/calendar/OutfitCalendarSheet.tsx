import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import SafeImage from "@/components/ui/SafeImage";
import { Plus, Calendar as CalendarIcon, Loader2, X, Shirt } from "lucide-react";
import { toast } from "sonner";
import { ignoreToastInteractOutside } from "@/lib/radixToastGuard";
import { getCachedSignedUrls } from "@/utils/signedUrlCache";

export const OutfitCalendarSheet = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLookbookOpen, setIsLookbookOpen] = useState(false);

  const today = startOfToday();
  const next14Days = Array.from({ length: 14 }).map((_, i) => addDays(today, i));

  const { data: plannedOutfits = [], isLoading: isLoadingPlanned } = useQuery({
    queryKey: ["planned-outfits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planned_outfits")
        .select(`*, lookbook_outfits (id, name, garment_ids)`)
        .eq("user_id", user!.id)
        .gte("planned_date", format(today, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  const { data: lookbook = [], isLoading: isLoadingLookbook } = useQuery({
    queryKey: ["lookbook-with-garments", user?.id],
    queryFn: async () => {
      const { data: outfits, error } = await supabase
        .from("lookbook_outfits")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      if (!outfits || outfits.length === 0) return [];

      const allIds = Array.from(new Set(outfits.flatMap((o: any) => o.garment_ids || [])));
      if (allIds.length === 0) return outfits.map((o: any) => ({ ...o, garments: [] }));

      const { data: items } = await supabase
        .from("closet_items")
        .select("id, name, category, image_url, thumbnail_url")
        .in("id", allIds);

      const paths = (items || []).map((g: any) => g.thumbnail_url || g.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", paths);

      const itemMap = new Map<string, any>();
      for (const g of items || []) {
        const path = g.thumbnail_url || g.image_url;
        itemMap.set(g.id, { ...g, image_url: urlMap[path] || g.image_url });
      }

      return outfits.map((o: any) => ({
        ...o,
        garments: (o.garment_ids || []).map((id: string) => itemMap.get(id)).filter(Boolean),
      }));
    },
    enabled: !!user && isLookbookOpen,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ date, lookbookId }: { date: Date; lookbookId: string }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { error } = await supabase.from("planned_outfits").upsert(
        { user_id: user!.id, planned_date: dateStr, lookbook_id: lookbookId },
        { onConflict: 'user_id, planned_date' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planned-outfits"] });
      toast.success("Outfit scheduled!");
      setIsLookbookOpen(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planned_outfits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planned-outfits"] });
      toast.success("Outfit removed from schedule.");
    },
  });

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsLookbookOpen(true);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10" onInteractOutside={ignoreToastInteractOutside}>
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 font-outfit">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Outfit Calendar
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2">
            {isLoadingPlanned ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {next14Days.map((date) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const planned = plannedOutfits.find((p: any) => p.planned_date === dateStr);

                  return (
                    <div key={dateStr} className="flex items-center gap-3 min-h-[56px]">
                      <div className="w-12 text-center shrink-0">
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">
                          {format(date, 'EEE')}
                        </p>
                        <p className="text-lg font-bold text-foreground font-outfit">
                          {format(date, 'd')}
                        </p>
                      </div>

                      {planned ? (
                        <GlassCard className="flex-1 flex items-center justify-between p-3 !rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {(planned as any).lookbook_outfits?.name ?? "Outfit"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(planned as any).lookbook_outfits?.garment_ids?.length ?? 0} items
                            </p>
                          </div>
                          <button
                            onClick={() => removeMutation.mutate(planned.id)}
                            className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </GlassCard>
                      ) : (
                        <button
                          onClick={() => handleDayClick(date)}
                          className="flex-1 rounded-xl border-2 border-dashed border-border flex items-center gap-2 px-4 py-3 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm">Plan Outfit</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Drawer open={isLookbookOpen} onOpenChange={setIsLookbookOpen}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader>
            <DrawerTitle className="font-outfit">
              Select for {selectedDate && format(selectedDate, 'MMM d')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-3 overflow-y-auto">
            {isLoadingLookbook ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : lookbook.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Your Lookbook is empty. Create outfits in your Wardrobe first!
              </p>
            ) : (
              lookbook.map((outfit: any) => {
                const garments: any[] = outfit.garments || [];
                const isGenericName = !outfit.name || /^(my outfit|vora stylist look|outfit)$/i.test(String(outfit.name).trim());
                const subtitle = garments.length > 0
                  ? garments.slice(0, 2).map((g) => g.name || g.category || "Item").join(" + ")
                  : `${outfit.garment_ids?.length ?? 0} items`;
                const thumbs = garments.slice(0, 4);
                return (
                  <GlassCard
                    key={outfit.id}
                    className="p-3 !rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => selectedDate && assignMutation.mutate({ date: selectedDate, lookbookId: outfit.id })}
                  >
                    <div className="flex gap-3">
                      <div className="grid grid-cols-2 gap-1 w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted">
                        {thumbs.length > 0 ? (
                          <>
                            {thumbs.map((g, i) => (
                              <div key={g.id || i} className="bg-muted overflow-hidden">
                                <SafeImage src={g.image_url} alt={g.name || "Garment"} fit="contain" />
                              </div>
                            ))}
                            {thumbs.length < 4 && Array.from({ length: 4 - thumbs.length }).map((_, i) => (
                              <div key={`empty-${i}`} className="bg-muted/50" />
                            ))}
                          </>
                        ) : (
                          <div className="col-span-2 row-span-2 flex items-center justify-center text-muted-foreground">
                            <Shirt className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground truncate">
                            {outfit.name || "Outfit"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {isGenericName ? subtitle : `${garments.length || outfit.garment_ids?.length || 0} items · ${subtitle}`}
                          </p>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button size="sm" variant="secondary" className="rounded-lg text-xs h-7 px-3">
                            Select
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
