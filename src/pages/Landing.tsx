import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import VoraLogo from "@/components/VoraLogo";
import { ChevronRight } from "lucide-react";
import outfitJacket from "@/assets/outfit-jacket.png";
import outfitTee from "@/assets/outfit-tee.png";
import outfitJeans from "@/assets/outfit-jeans.png";
import outfitSneakers from "@/assets/outfit-sneakers.png";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center min-h-screen bg-background relative overflow-hidden">
      {/* Subtle warm radial glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      {/* Decorative right-side clothes rack hint */}
      <div className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[200px] h-[300px] rounded-xl bg-primary/5 blur-[60px] pointer-events-none" />

      {/* Main content */}
      <div className="flex flex-col items-center w-full relative z-10 px-[6%] pt-12 pb-8 pb-safe">

        {/* Logo + Wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <VoraLogo className="w-[72px] h-[72px]" />

          <h1
            className="font-outfit text-foreground text-center mt-2"
            style={{ fontWeight: 800, fontSize: 72, letterSpacing: "-0.01em", lineHeight: 1 }}
          >
            VORA
          </h1>
        </motion.div>

        {/* Slogan */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="font-inter text-center"
          style={{ fontWeight: 500, fontSize: 18, lineHeight: "26px", color: "rgba(45,45,45,0.70)", marginTop: 14, marginBottom: 28 }}
        >
          AI Outfit Planner &amp; Everyday Stylist
        </motion.p>

        {/* Today's Outfit Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-[88%] max-w-[420px]"
        >
          <div
            className="bg-card rounded-[44px] p-7"
            style={{ boxShadow: "0px 18px 60px rgba(0,0,0,0.08)" }}
          >
            {/* Card header */}
            <h3
              className="font-inter text-left"
              style={{ fontWeight: 600, fontSize: 18, color: "rgba(45,45,45,0.75)" }}
            >
              Today's Outfit
            </h3>
            <div className="mt-4 mb-[18px]" style={{ height: 1, background: "rgba(45,45,45,0.10)" }} />

            {/* Outfit content */}
            <div className="flex items-center gap-5">
              {/* Outfit flat-lay image */}
              <div className="w-[55%] flex-shrink-0 relative" style={{ height: 200 }}>
                {/* Tee - behind jacket, top center-right */}
                <img
                  src={outfitTee}
                  alt="White t-shirt"
                  className="absolute rounded-lg object-contain"
                  style={{ width: 90, height: 90, top: 0, left: 55, zIndex: 1, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.06))" }}
                  loading="lazy"
                />
                {/* Jacket - top left, overlapping tee */}
                <img
                  src={outfitJacket}
                  alt="Beige jacket"
                  className="absolute rounded-lg object-contain"
                  style={{ width: 115, height: 125, top: 0, left: 0, zIndex: 3, filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.08))" }}
                  loading="lazy"
                />
                {/* Jeans - right side, behind jacket */}
                <img
                  src={outfitJeans}
                  alt="Light blue jeans"
                  className="absolute rounded-lg object-contain"
                  style={{ width: 85, height: 110, top: 50, right: -5, zIndex: 2, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.06))" }}
                  loading="lazy"
                />
                {/* Sneakers - front bottom-left, overlapping jacket */}
                <img
                  src={outfitSneakers}
                  alt="White sneakers"
                  className="absolute rounded-lg object-contain"
                  style={{ width: 80, height: 70, bottom: 0, left: 15, zIndex: 4, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.07))" }}
                  loading="lazy"
                />
              </div>

              {/* Label + CTA */}
              <div className="flex flex-col gap-3 items-start">
                <span
                  className="font-inter"
                  style={{ fontWeight: 500, fontSize: 16, color: "rgba(45,45,45,0.70)" }}
                >
                  Casual &amp; Chic
                </span>
                <button
                  className="flex items-center gap-1 text-primary-foreground font-inter rounded-full"
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    background: "hsl(var(--primary))",
                    padding: "10px 18px",
                    boxShadow: "0px 10px 30px rgba(217,119,87,0.25)",
                  }}
                  disabled={!agreed}
                >
                  See Outfit Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Supporting line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="font-inter text-center"
          style={{ fontWeight: 500, fontSize: 16, color: "rgba(45,45,45,0.75)", marginTop: 28, marginBottom: 22 }}
        >
          Get outfit ideas from your wardrobe.
        </motion.p>

        {/* Checkbox consent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-[88%] max-w-[420px]"
        >
          <label className="flex items-start gap-[18px] cursor-pointer">
            {/* Custom circle checkbox */}
            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className="flex-shrink-0 w-[28px] h-[28px] rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors"
              style={{
                borderColor: agreed ? "hsl(var(--primary))" : "rgba(45,45,45,0.25)",
                background: agreed ? "hsl(var(--primary))" : "transparent",
              }}
            >
              {agreed && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span
              className="font-inter"
              style={{ fontWeight: 400, fontSize: 13, lineHeight: "20px", color: "rgba(45,45,45,0.60)" }}
            >
              I agree to the{" "}
              <a href="/legal" className="underline underline-offset-2" style={{ color: "rgba(45,45,45,0.80)" }}>
                Terms of Service
              </a>{" "}
              and consent to the processing of my biometric data as described in the{" "}
              <a href="/legal?tab=privacy" className="underline underline-offset-2" style={{ color: "rgba(45,45,45,0.80)" }}>
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="w-[88%] max-w-[420px] flex flex-col gap-3 mt-6"
        >
          {/* Primary CTA */}
          <button
            className="w-full font-inter text-primary-foreground rounded-full transition-all"
            style={{
              fontWeight: 700,
              fontSize: 18,
              height: 60,
              background: "hsl(var(--primary))",
              boxShadow: agreed ? "0px 18px 50px rgba(217,119,87,0.25)" : "none",
              opacity: agreed ? 1 : 0.55,
              borderRadius: 999,
            }}
            disabled={!agreed}
          >
            Create My First Outfit
          </button>

          {/* Secondary CTA */}
          <button
            className="w-full font-inter rounded-full transition-all"
            style={{
              fontWeight: 700,
              fontSize: 18,
              height: 60,
              background: "rgba(255,255,255,0.35)",
              border: "2px solid rgba(45,45,45,0.08)",
              color: "rgba(45,45,45,0.40)",
              borderRadius: 999,
            }}
            disabled={!agreed}
          >
            Sign In
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
