import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import VoraLogo from "@/components/VoraLogo";
import { ChevronRight } from "lucide-react";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-background relative overflow-hidden">
      {/* Soft warm radial glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      {/* Decorative right-side clothes rack hint */}
      <div className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[200px] h-[300px] rounded-xl bg-primary/5 blur-[60px] pointer-events-none" />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          {/* Logo */}
          <VoraLogo className="w-16 h-16" />

          {/* Brand name */}
          <h1 className="text-6xl font-black tracking-[-0.04em] text-foreground font-outfit">
            VORA
          </h1>
          <p className="text-muted-foreground text-base text-center font-inter">
            AI Outfit Planner & Everyday Stylist
          </p>
        </motion.div>

        {/* Today's Outfit Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-8 w-full max-w-[340px]"
        >
          <div className="glass-card-strong rounded-2xl p-5">
            <h3 className="font-outfit font-semibold text-foreground text-base mb-3">Today's Outfit</h3>
            <div className="h-px bg-border mb-4" />
            <div className="flex items-center gap-4">
              {/* Placeholder outfit thumbnails */}
              <div className="flex -space-x-3">
                <div className="w-16 h-20 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground">👕</div>
                <div className="w-16 h-20 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground">👖</div>
                <div className="w-16 h-20 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground">👟</div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-outfit font-medium text-foreground text-sm">Casual & Chic</span>
                <Button
                  size="sm"
                  className="rounded-full text-xs px-4 h-8"
                  disabled={!agreed}
                >
                  See Outfit Details <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-border'}`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-muted-foreground text-sm text-center mt-5 font-inter"
        >
          Get outfit ideas from your wardrobe.
        </motion.p>
      </div>

      {/* Bottom section */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="w-full px-6 pb-8 pt-2 flex flex-col items-center gap-4 relative z-10 pb-safe"
      >
        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer max-w-[340px] w-full">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5 border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary min-w-[20px] min-h-[20px]"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I agree to the{" "}
            <a href="/legal" className="text-foreground underline underline-offset-2 font-medium">
              Terms of Service
            </a>{" "}
            and consent to the processing of my biometric data as described in the{" "}
            <a href="/legal?tab=privacy" className="text-foreground underline underline-offset-2 font-medium">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {/* CTA Buttons */}
        <Button
          className="w-full max-w-[340px] h-14 text-base font-bold rounded-full shadow-lg"
          size="lg"
          disabled={!agreed}
        >
          Create My First Outfit
        </Button>

        <Button
          variant="outline"
          className="w-full max-w-[340px] h-14 text-base font-semibold rounded-full"
          size="lg"
          disabled={!agreed}
        >
          Sign In
        </Button>
      </motion.div>
    </div>
  );
};

export default Landing;
