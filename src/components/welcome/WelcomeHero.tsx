import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";
import MagneticButton from "./MagneticButton";

const WelcomeHero = () => {
  const scrollToRequestAccess = () => {
    const el = document.getElementById("request-access");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="min-h-[85vh] flex flex-col items-center justify-center text-center px-6">
      <div className="mb-12" />

      <motion.h1
        {...fadeUp(0.15)}
        className="font-serif-display font-light text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6 max-w-4xl text-foreground"
      >
        Your Wardrobe,
        <br />
        <span className="italic">Mastered</span> by AI.
      </motion.h1>

      <motion.p
        {...fadeUp(0.3)}
        className="font-outfit text-foreground/50 max-w-2xl text-base md:text-lg lg:text-xl leading-relaxed mb-14"
      >
        Stop staring at a closet full of clothes with nothing to wear.
        We are digitizing your physical space with advanced spatial AI.
      </motion.p>

      <motion.div {...fadeUp(0.45)}>
        <MagneticButton
          type="button"
          onClick={scrollToRequestAccess}
          className="border border-foreground/60 px-10 py-4 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium text-foreground hover:bg-foreground hover:text-background transition-colors duration-300 whitespace-nowrap"
        >
          Request Access
        </MagneticButton>
      </motion.div>

      <motion.div
        {...fadeUp(0.7)}
        className="mt-20 flex flex-col items-center gap-2 text-muted-foreground"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] font-outfit">Discover</span>
        <div className="w-px h-8 bg-muted-foreground/50" />
      </motion.div>
    </section>
  );
};

export default WelcomeHero;
