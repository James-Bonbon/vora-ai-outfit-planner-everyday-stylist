import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import VoraLogo from "@/components/VoraLogo";
import { ChevronRight } from "lucide-react";

import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Landing = () => {
  const [agreed, setAgreed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect if already logged in (must be in useEffect, not during render)
  useEffect(() => {
    if (!loading && user) {
      navigate("/home", { replace: true });
    }
  }, [loading, user, navigate]);

  if (!loading && user) return null;

  const handleGoogleSignIn = async () => {
    if (!agreed) return;
    setSigningIn(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/home",
      });
      if (result.error) {
        toast.error("Sign in failed. Please try again.");
        console.error("Auth error:", result.error);
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      console.error("Auth error:", err);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background relative overflow-hidden">
      {/* Subtle warm radial glow */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      {/* Decorative right-side clothes rack hint */}
      <div className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[200px] h-[300px] rounded-xl bg-primary/5 blur-[60px] pointer-events-none" />

      {/* Main content */}
      <div className="flex flex-col items-center w-full relative z-10 px-[6%] pt-6 pb-6 pb-safe">
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
          className="font-inter text-center text-muted-foreground"
          style={{ fontWeight: 500, fontSize: 18, lineHeight: "26px", marginTop: 10, marginBottom: 20 }}
        >
          AI Outfit Planner &amp; Everyday Stylist
        </motion.p>

        {/* Today's Outfit Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-[100%] max-w-[500px]"
        >
          <div className="bg-card rounded-[24px] p-7" style={{ boxShadow: "0px 18px 60px rgba(0,0,0,0.08)" }}>
            <h3 className="font-inter text-left text-muted-foreground" style={{ fontWeight: 600, fontSize: 18 }}>
              Today's Outfit
            </h3>
            <div className="mt-4 mb-[18px]" style={{ height: 1, background: "hsl(var(--border))" }} />

            <div className="flex items-center gap-4">
              <div className="w-[62%] flex-shrink-0">
                <img
                  src="/outfit-collage.png"
                  alt="Casual outfit: beige jacket, white tee, light blue jeans, white sneakers"
                  className="w-full h-full rounded-xl object-cover transition-transform"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col gap-3 items-start flex-1">
                <span
                  className="font-inter text-muted-foreground whitespace-nowrap"
                  style={{ fontWeight: 500, fontSize: 16 }}
                >
                  Casual &amp; Chic
                </span>
                <button
                  onClick={handleGoogleSignIn}
                  className="flex flex-col items-start text-primary-foreground font-inter transition-all bg-primary"
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    lineHeight: "1.2",
                    padding: "10px 14px",
                    opacity: agreed ? 1 : 0.55,
                    borderRadius: "20px",
                    width: "100px", // Forces "Outfit" to the second line
                  }}
                  disabled={!agreed}
                >
                  <span>Plan My</span>
                  <span className="flex items-center gap-1">
                    Outfit <ChevronRight className="w-3 h-3" />
                  </span>
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
          className="font-inter text-center text-muted-foreground"
          style={{ fontWeight: 500, fontSize: 16, marginTop: 14, marginBottom: 14 }}
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
            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className="flex-shrink-0 w-[28px] h-[28px] rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors"
              style={{
                borderColor: agreed ? "hsl(var(--primary))" : "hsl(var(--border))",
                background: agreed ? "hsl(var(--primary))" : "transparent",
              }}
            >
              {agreed && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7L6 10L11 4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className="font-inter text-muted-foreground"
              style={{ fontWeight: 400, fontSize: 13, lineHeight: "20px" }}
            >
              I agree to the{" "}
              <a href="/legal" className="underline underline-offset-2 text-foreground/80">
                Terms of Service
              </a>{" "}
              and consent to the processing of my biometric data as described in the{" "}
              <a href="/legal?tab=privacy" className="underline underline-offset-2 text-foreground/80">
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
          className="w-[88%] max-w-[420px] flex flex-col gap-3 mt-4"
        >
          {/* Primary CTA - Sign up with Google */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full font-inter text-primary-foreground rounded-full transition-all bg-primary"
            style={{
              fontWeight: 700,
              fontSize: 18,
              height: 60,
              opacity: agreed ? 1 : 0.55,
              borderRadius: 999,
            }}
            disabled={!agreed || signingIn}
          >
            {signingIn ? "Signing in..." : "Create My First Outfit"}
          </button>

          {/* Secondary CTA - Sign in with Google */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full font-inter rounded-full transition-all"
            style={{
              fontWeight: 700,
              fontSize: 18,
              height: 60,
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
              color: agreed ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
              borderRadius: 999,
            }}
            disabled={!agreed || signingIn}
          >
            Sign In
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
