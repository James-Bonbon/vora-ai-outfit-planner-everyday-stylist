import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import VoraLogo from "@/components/VoraLogo";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-background relative overflow-hidden">
      {/* Soft warm radial glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-5"
        >
          {/* Logo */}
          <VoraLogo className="w-16 h-16" />

          {/* Brand name */}
          <h1 className="text-6xl font-black tracking-[-0.04em] text-foreground font-outfit">
            VORA
          </h1>
          <p className="text-muted-foreground text-base text-center font-inter">
            AI Styling. Daily Planning. Zero Effort.
          </p>
        </motion.div>
      </div>

      {/* Bottom section — moved up with less padding */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="w-full px-6 pb-6 pt-2 flex flex-col items-center gap-4 relative z-10 pb-safe"
      >
        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer max-w-[320px] w-full">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5 border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary min-w-[20px] min-h-[20px]"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I agree to the{" "}
            <Link to="/legal" className="text-foreground underline underline-offset-2 font-medium">
              Terms of Service
            </Link>{" "}
            and consent to the processing of my biometric data as described in the{" "}
            <Link to="/legal" className="text-foreground underline underline-offset-2 font-medium">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {/* CTA Buttons */}
        <Button
          className="w-full max-w-[340px] h-14 text-base font-bold rounded-full shadow-lg"
          size="lg"
          disabled={!agreed}
        >
          Get Started
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
