import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Sparkles, Check } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 1, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

const WelcomePage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Footer form
  const [footerEmail, setFooterEmail] = useState("");
  const [footerLoading, setFooterLoading] = useState(false);
  const [footerSubmitted, setFooterSubmitted] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent,
    emailValue: string,
    setLoadingFn: (v: boolean) => void,
    setSubmittedFn: (v: boolean) => void
  ) => {
    e.preventDefault();
    if (!emailValue || !emailValue.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoadingFn(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-waitlist", {
        body: { email: emailValue },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmittedFn(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingFn(false);
    }
  };

  const SuccessMessage = ({ inverted = false }: { inverted?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${inverted ? "bg-background/15" : "bg-foreground/10"}`}>
        <Check className={`w-5 h-5 ${inverted ? "text-background" : "text-foreground"}`} />
      </div>
      <p className={`text-lg font-medium font-serif-display ${inverted ? "text-background" : "text-foreground"}`}>
        You are on the list.
      </p>
      <p className={`text-sm ${inverted ? "text-background/60" : "text-muted-foreground"}`}>
        Check your inbox for your early access ticket.
      </p>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e6e1] selection:bg-[#e8e6e1]/20">
      {/* ─── HERO ─── */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center text-center px-6">
        {/* Wordmark */}
        <motion.p
          {...fadeUp(0)}
          className="font-outfit text-xs uppercase tracking-[0.35em] text-[#e8e6e1]/40 mb-12"
        >
          VORA
        </motion.p>

        {/* Headline */}
        <motion.h1
          {...fadeUp(0.15)}
          className="font-serif-display font-light text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6 max-w-4xl"
        >
          Your Wardrobe,
          <br />
          <span className="italic">Mastered</span> by AI.
        </motion.h1>

        {/* Sub */}
        <motion.p
          {...fadeUp(0.3)}
          className="font-outfit text-[#e8e6e1]/50 max-w-2xl text-base md:text-lg lg:text-xl leading-relaxed mb-14"
        >
          Stop staring at a closet full of clothes with nothing to wear.
          We are digitizing your physical space with advanced spatial AI.
        </motion.p>

        {/* Form */}
        {!submitted ? (
          <motion.form
            {...fadeUp(0.45)}
            onSubmit={(e) => handleSubmit(e, email, setLoading, setSubmitted)}
            className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
              className="w-full sm:flex-1 bg-transparent border-b border-[#e8e6e1]/20 focus:border-[#e8e6e1] py-3 text-sm font-outfit placeholder:text-[#e8e6e1]/30 focus:outline-none transition-colors disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full sm:w-auto border border-[#e8e6e1]/60 px-8 py-3 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium hover:bg-[#e8e6e1] hover:text-[#0a0a0a] transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? "Reserving…" : "Request Access"}
            </button>
          </motion.form>
        ) : (
          <SuccessMessage />
        )}

        {/* Scroll hint */}
        <motion.div
          {...fadeUp(0.7)}
          className="mt-20 flex flex-col items-center gap-2 text-[#e8e6e1]/20"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-outfit">Discover</span>
          <div className="w-px h-8 bg-[#e8e6e1]/10" />
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="max-w-6xl mx-auto py-24 md:py-32 px-6 flex flex-col gap-32 md:gap-48">
        {/* Feature 1 */}
        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
          <div className="w-full md:w-1/2 text-left">
            <motion.p
              {...fadeUp(0)}
              className="text-[10px] uppercase tracking-[0.3em] text-[#e8e6e1]/30 font-outfit mb-4"
            >
              01 — Spatial Intelligence
            </motion.p>
            <motion.h2
              {...fadeUp(0.1)}
              className="font-serif-display font-light text-3xl md:text-5xl tracking-tight mb-6 leading-[1.1]"
            >
              Spatial
              <br />
              <span className="italic">Intelligence.</span>
            </motion.h2>
            <motion.p
              {...fadeUp(0.2)}
              className="font-outfit text-[#e8e6e1]/50 text-base md:text-lg leading-relaxed max-w-lg"
            >
              Upload a photo. Our proprietary AI instantly maps the physical boundaries
              of your closet, creating an interactive, glass-pane layout of your actual room.
            </motion.p>
          </div>
          <motion.div
            {...fadeUp(0.25)}
            className="w-full md:w-1/2"
          >
            <div className="aspect-square rounded-2xl bg-[#e8e6e1]/[0.03] border border-[#e8e6e1]/[0.06] flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#e8e6e1]/[0.05] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#e8e6e1]/20" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#e8e6e1]/20 font-outfit">
                  AI Wardrobe Map
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Feature 2 */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-24">
          <div className="w-full md:w-1/2 text-left">
            <motion.p
              {...fadeUp(0)}
              className="text-[10px] uppercase tracking-[0.3em] text-[#e8e6e1]/30 font-outfit mb-4"
            >
              02 — Automated Curation
            </motion.p>
            <motion.h2
              {...fadeUp(0.1)}
              className="font-serif-display font-light text-3xl md:text-5xl tracking-tight mb-6 leading-[1.1]"
            >
              Automated
              <br />
              <span className="italic">Curation.</span>
            </motion.h2>
            <motion.p
              {...fadeUp(0.2)}
              className="font-outfit text-[#e8e6e1]/50 text-base md:text-lg leading-relaxed max-w-lg"
            >
              Point the Smart Camera at a garment. The AI identifies it, tags it,
              and automatically assigns it to its precise physical zone in your room.
            </motion.p>
          </div>
          <motion.div
            {...fadeUp(0.25)}
            className="w-full md:w-1/2"
          >
            <div className="aspect-square rounded-2xl bg-[#e8e6e1]/[0.03] border border-[#e8e6e1]/[0.06] flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#e8e6e1]/[0.05] flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-[#e8e6e1]/20" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#e8e6e1]/20 font-outfit">
                  Smart Camera
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── VELVET ROPE FOOTER CTA ─── */}
      <section className="min-h-[50vh] flex flex-col items-center justify-center text-center bg-[#e8e6e1] text-[#0a0a0a] py-24 px-6">
        <motion.h2
          {...fadeUp(0)}
          className="font-serif-display font-light text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6"
        >
          Request <span className="italic">Early Access.</span>
        </motion.h2>

        <motion.p
          {...fadeUp(0.1)}
          className="font-outfit text-[#0a0a0a]/50 max-w-lg text-base md:text-lg leading-relaxed mb-10"
        >
          Spots for the private beta are strictly limited. Join the atelier.
        </motion.p>

        {!footerSubmitted ? (
          <motion.form
            {...fadeUp(0.2)}
            onSubmit={(e) => handleSubmit(e, footerEmail, setFooterLoading, setFooterSubmitted)}
            className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md"
          >
            <input
              type="email"
              value={footerEmail}
              onChange={(e) => setFooterEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={footerLoading}
              className="w-full sm:flex-1 bg-transparent border-b border-[#0a0a0a]/20 focus:border-[#0a0a0a] py-3 text-sm font-outfit text-[#0a0a0a] placeholder:text-[#0a0a0a]/30 focus:outline-none transition-colors disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={footerLoading || !footerEmail}
              className="w-full sm:w-auto border border-[#0a0a0a]/60 text-[#0a0a0a] px-8 py-3 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium hover:bg-[#0a0a0a] hover:text-[#e8e6e1] transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {footerLoading ? "Reserving…" : "Request Access"}
            </button>
          </motion.form>
        ) : (
          <SuccessMessage inverted />
        )}

        {/* Bottom line */}
        <motion.p
          {...fadeUp(0.4)}
          className="mt-16 text-[10px] uppercase tracking-[0.35em] text-[#0a0a0a]/25 font-outfit"
        >
          By invitation only
        </motion.p>
      </section>
    </div>
  );
};

export default WelcomePage;
