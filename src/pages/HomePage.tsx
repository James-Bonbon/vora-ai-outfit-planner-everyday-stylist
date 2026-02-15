import GlassCard from "@/components/GlassCard";
import { Sparkles, DoorOpen, Scan, Heart } from "lucide-react";

const HomePage = () => {
  return (
    <div className="pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome to <span className="text-primary">VORA</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI-powered style companion</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="col-span-2 flex items-center gap-4 p-5" glowOnHover>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Scan className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">AI Mirror</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Try on outfits with photorealistic AI</p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3 p-4" glowOnHover>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Wardrobe</h3>
            <p className="text-xs text-muted-foreground">Manage your closet</p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3 p-4" glowOnHover>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Beauty</h3>
            <p className="text-xs text-muted-foreground">Skincare routines</p>
          </div>
        </GlassCard>

        <GlassCard className="col-span-2 flex items-center gap-4 p-5" glowOnHover>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">VORA Pro</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Unlock AI try-ons, stain care & more</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default HomePage;
