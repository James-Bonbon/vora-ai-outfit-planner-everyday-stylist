import { useState } from "react";
import { addDays, format, isToday } from "date-fns";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarDays, Sparkles } from "lucide-react";

const VIBES = ["Work / Smart Casual", "Relaxed / Lounge", "Night Out", "Active"] as const;
const WEATHERS = ["Hot", "Mild", "Chilly", "Rainy"] as const;

export type OutfitPlan = { vibe: string; weather: string; date: string };

interface Props {
  onGenerate: (plan: OutfitPlan) => void;
}

const OutfitCalendar = ({ onGenerate }: Props) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const handleDayClick = (date: Date) => {
    if (isToday(date)) {
      setSelectedVibe(null);
      setSelectedWeather(null);
      setShowModal(true);
    }
  };

  const handleGenerate = () => {
    if (!selectedVibe || !selectedWeather) return;
    setShowModal(false);
    onGenerate({ vibe: selectedVibe, weather: selectedWeather, date: new Date().toISOString() });
  };

  return (
    <>
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-outfit">Outfit Calendar</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {days.map((date) => {
            const today = isToday(date);
            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[52px] transition-colors ${
                  today
                    ? "bg-primary text-primary-foreground cursor-pointer"
                    : "bg-card border border-border text-muted-foreground cursor-default"
                }`}
              >
                <span className="text-[10px] font-medium uppercase">
                  {today ? "Today" : format(date, "EEE")}
                </span>
                <span className="text-lg font-bold">{format(date, "d")}</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit">Plan Today's Outfit</DialogTitle>
            <DialogDescription>Tell us the vibe and weather so we can style you.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                What's the vibe today?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSelectedVibe(v)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border min-h-[44px] ${
                      selectedVibe === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                What's the weather like?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WEATHERS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeather(w)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border min-h-[44px] ${
                      selectedWeather === w
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full rounded-xl gap-2 h-11"
              disabled={!selectedVibe || !selectedWeather}
              onClick={handleGenerate}
            >
              <Sparkles className="w-4 h-4" />
              Generate Outfit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OutfitCalendar;
