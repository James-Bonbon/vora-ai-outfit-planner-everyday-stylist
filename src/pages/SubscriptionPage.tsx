import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { motion } from "framer-motion";
import { toast } from "sonner";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with the basics",
    features: [
      "5 AI try-ons per month",
      "Unlimited wardrobe uploads",
      "Basic care guides",
      "Wishlist",
    ],
    cta: "Current Plan",
    disabled: true,
    icon: Sparkles,
    accent: false,
  },
  {
    name: "Plus",
    price: "$12",
    yearlyPrice: "$120/yr",
    period: "/month",
    description: "For the style-conscious",
    features: [
      "30 AI try-ons per month",
      "AI stain removal guides",
      "Outfit calendar planning",
      "Priority generation",
    ],
    cta: "Upgrade to Plus",
    disabled: false,
    icon: Zap,
    accent: true,
  },
  {
    name: "Pro",
    price: "$20",
    yearlyPrice: "$200/yr",
    period: "/month",
    description: "Unlimited style power",
    features: [
      "Unlimited AI try-ons",
      "Advanced body-shape styling",
      "Custom style prompts",
      "Early access to new features",
    ],
    cta: "Upgrade to Pro",
    disabled: false,
    icon: Crown,
    accent: false,
  },
];

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const handleUpgrade = (tierName: string) => {
    toast.info(`${tierName} upgrade coming soon! We'll notify you when payments are live.`);
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl min-w-[44px] min-h-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-outfit">Upgrade VORA</h1>
            <p className="text-xs text-muted-foreground">Unlock your full styling potential</p>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center">
          <div className="flex bg-card rounded-xl p-1 border border-border">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Yearly <span className="text-[10px] opacity-80">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="space-y-4">
          {tiers.map((tier, i) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard
                  className={`p-5 space-y-4 ${
                    tier.accent ? "ring-2 ring-primary/50 relative" : ""
                  }`}
                >
                  {tier.accent && (
                    <span className="absolute -top-2.5 left-4 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Most Popular
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground font-outfit">{tier.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{tier.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-foreground font-outfit">
                        {billingCycle === "yearly" && tier.yearlyPrice
                          ? `$${Math.round(parseInt(tier.price.replace("$", "")) * 10 / 12)}`
                          : tier.price}
                      </span>
                      <span className="text-xs text-muted-foreground">{tier.period}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tier.features.map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs text-foreground">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full rounded-xl ${tier.accent ? "" : ""}`}
                    variant={tier.disabled ? "outline" : "default"}
                    disabled={tier.disabled}
                    onClick={() => handleUpgrade(tier.name)}
                  >
                    {tier.cta}
                  </Button>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
