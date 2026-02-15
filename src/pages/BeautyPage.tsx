import GlassCard from "@/components/GlassCard";
import { Sparkles, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

const BeautyPage = () => {
  return (
    <div className="pt-6 space-y-5">
      <h1 className="text-2xl font-bold text-foreground">Beauty</h1>

      <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Skincare Concierge</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          Scan your products and get a personalized routine built by AI
        </p>
        <Button variant="outline" className="mt-5 rounded-xl gap-2">
          <Camera className="w-4 h-4" />
          Scan a Product
        </Button>
      </GlassCard>
    </div>
  );
};

export default BeautyPage;
