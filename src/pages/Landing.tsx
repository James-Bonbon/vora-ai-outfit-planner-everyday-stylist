import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-6xl font-black tracking-[-0.04em] text-foreground">
            V<span className="text-primary">O</span>RA
          </h1>
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-muted-foreground">
            AI Stylist & Care Concierge
          </p>
        </div>

        {/* Tagline */}
        <p className="text-center text-muted-foreground text-base max-w-[280px] leading-relaxed">
          Your hyper-realistic virtual closet, stylist, and garment care expert — powered by AI.
        </p>

        {/* Consent Checkbox */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-[320px]"
        >
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5 border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary min-w-[20px] min-h-[20px]"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I agree to the{" "}
              <Link to="/legal" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Terms of Service
              </Link>{" "}
              and consent to the processing of my biometric data as described in the{" "}
              <Link to="/legal" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-full max-w-[300px]"
        >
          <Button
            className="w-full h-14 text-base font-bold rounded-2xl glow-lime disabled:opacity-40 disabled:shadow-none"
            size="lg"
            disabled={!agreed}
          >
            Join VORA with Google
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground/60 text-center max-w-[260px]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};

export default Landing;
