import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sparkles, Shirt, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import GlassCard from "@/components/GlassCard";

const VIBES = ["Casual", "Streetwear", "Smart Casual", "Minimalist"];

const ColdStartOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({ vibe: "Casual", fit: "Fitted", colors: "Neutral" });

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ style_preferences: preferences } as any)
        .eq("user_id", user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-data"] });

      toast.success("Welcome to VORA! Let's build your wardrobe.");
      navigate("/home", { replace: true });
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Failed to save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        {step === 1 && (
          <GlassCard className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-outfit">Meet Your AI Stylist</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              VORA uses AI to instantly digitize your closet, track your laundry, and build perfectly styled outfits for your actual calendar.
            </p>
            <Button onClick={() => setStep(2)} className="w-full rounded-xl mt-4">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </GlassCard>
        )}

        {step === 2 && (
          <GlassCard className="p-8 space-y-5">
            <h2 className="text-xl font-bold text-foreground font-outfit text-center">What's your vibe?</h2>
            <p className="text-sm text-muted-foreground text-center">This helps your AI Stylist pull the right looks.</p>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Everyday Style</p>
              <div className="grid grid-cols-2 gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setPreferences({ ...preferences, vibe: v })}
                    className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                      preferences.vibe === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground border border-border hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => setStep(3)} className="w-full rounded-xl mt-4">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </GlassCard>
        )}

        {step === 3 && (
          <GlassCard className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Shirt className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground font-outfit">The Magic 5</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your goal today is to scan your first 5 items into your Wardrobe so the AI has something to style!
            </p>
            <div className="text-left space-y-2 py-2">
              <p className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Add 3 Tops
              </p>
              <p className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Add 2 Bottoms
              </p>
            </div>
            <Button onClick={handleComplete} disabled={saving} className="w-full rounded-xl">
              {saving ? "Saving..." : "Open My Wardrobe"}
            </Button>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default ColdStartOnboarding;
