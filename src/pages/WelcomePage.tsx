import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import VoraLogo from "@/components/VoraLogo";

const WelcomePage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-waitlist", {
        body: { email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-6 md:px-12 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg text-center flex flex-col items-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-10 md:mb-14"
        >
          <VoraLogo />
        </motion.div>

        {/* Hero headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="text-4xl md:text-6xl font-outfit font-light tracking-tight text-foreground leading-[1.1] mb-4 md:mb-6"
        >
          The future of{" "}
          <span className="text-primary font-medium">personal style</span>{" "}
          is arriving.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-muted-foreground text-base md:text-lg max-w-md mb-10 md:mb-14 leading-relaxed"
        >
          AI-powered outfit planning, wardrobe intelligence, and styling — crafted for the discerning.
          Join the private waitlist.
        </motion.p>

        {/* Form / Confirmation */}
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="w-full flex flex-col sm:flex-row gap-3 items-center"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                className="w-full sm:flex-1 h-12 md:h-14 px-5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full sm:w-auto h-12 md:h-14 px-8 rounded-xl bg-primary text-primary-foreground font-medium text-sm md:text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Reserving...
                  </>
                ) : (
                  <>
                    Request Access
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <p className="text-foreground text-lg md:text-xl font-medium">
                You are on the list.
              </p>
              <p className="text-muted-foreground text-sm md:text-base">
                Check your inbox for your early access ticket.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="text-muted-foreground/50 text-xs mt-12 md:mt-16 tracking-widest uppercase"
        >
          By invitation only
        </motion.p>
      </motion.div>
    </div>
  );
};

export default WelcomePage;
