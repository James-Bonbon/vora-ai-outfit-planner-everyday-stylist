import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex flex-col items-center justify-between min-h-screen relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, hsl(340 80% 55%) 0%, hsl(270 75% 50%) 40%, hsl(260 70% 45%) 70%, hsl(250 65% 35%) 100%)",
      }}
    >
      {/* Top glow */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-[hsl(340_80%_55%/0.4)] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[hsl(260_80%_40%/0.3)] blur-[120px] pointer-events-none" />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          {/* Logo */}
          <h1 className="text-7xl font-black tracking-[-0.04em] text-white" style={{ fontFamily: "serif" }}>
            VORA
          </h1>
          <p className="text-white/70 text-lg text-center">
            Glow up your wardrobe.
          </p>
        </motion.div>
      </div>

      {/* Bottom section */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="w-full px-6 pb-10 pt-4 flex flex-col items-center gap-4 relative z-10 pb-safe"
      >
        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer max-w-[320px] w-full">
          <Checkbox
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5 border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-purple-700 data-[state=checked]:border-white min-w-[20px] min-h-[20px]"
          />
          <span className="text-xs text-white/70 leading-relaxed">
            I agree to the{" "}
            <Link to="/legal" className="text-white underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and consent to the processing of my biometric data as described in the{" "}
            <Link to="/legal" className="text-white underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {/* CTA Buttons */}
        <Button
          className="w-full max-w-[340px] h-14 text-base font-bold rounded-full bg-white text-purple-800 hover:bg-white/90 disabled:opacity-40 disabled:bg-white/30 disabled:text-white/50 shadow-xl"
          size="lg"
          disabled={!agreed}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Get Started
        </Button>

        <Button
          variant="ghost"
          className="w-full max-w-[340px] h-14 text-base font-semibold rounded-full border border-white/20 text-white hover:bg-white/10"
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
