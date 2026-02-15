import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const Landing = () => {
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

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-full max-w-[300px]"
        >
          <Button
            className="w-full h-14 text-base font-bold rounded-2xl glow-lime"
            size="lg"
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
