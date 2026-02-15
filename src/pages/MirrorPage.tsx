import GlassCard from "@/components/GlassCard";
import { Scan, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const MirrorPage = () => {
  return (
    <div className="pt-6 space-y-5">
      <h1 className="text-2xl font-bold text-foreground">AI Mirror</h1>

      <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5 glow-lime">
          <Scan className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Virtual Try-On</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-[260px] leading-relaxed">
          See yourself in any outfit from your wardrobe with photorealistic AI generation
        </p>
        <Button className="mt-6 rounded-xl gap-2" size="lg">
          <Lock className="w-4 h-4" />
          Unlock with VORA Pro
        </Button>
      </GlassCard>
    </div>
  );
};

export default MirrorPage;
