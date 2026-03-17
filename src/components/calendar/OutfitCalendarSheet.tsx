import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

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
    queryKey: ["lookbook", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lookbook_outfits").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
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
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
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
        <DrawerContent className="max-h-[60vh]">
          <DrawerHeader>
            <DrawerTitle className="font-outfit">
              Select for {selectedDate && format(selectedDate, 'MMM d')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-2 overflow-y-auto">
            {isLoadingLookbook ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : lookbook.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Your Lookbook is empty. Create outfits in your Wardrobe first!
              </p>
            ) : (
              lookbook.map((outfit: any) => (
                <GlassCard
                  key={outfit.id}
                  className="flex items-center justify-between p-3 !rounded-xl cursor-pointer"
                  onClick={() => selectedDate && assignMutation.mutate({ date: selectedDate, lookbookId: outfit.id })}
                >
                  <p className="text-sm font-semibold text-foreground">{outfit.name}</p>
                  <Button size="sm" variant="secondary" className="rounded-lg text-xs">
                    Select
                  </Button>
                </GlassCard>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
