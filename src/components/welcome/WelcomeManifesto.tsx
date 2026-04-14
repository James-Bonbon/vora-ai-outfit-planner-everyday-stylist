import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";

const WelcomeManifesto = () => (
  <section className="max-w-3xl mx-auto py-24 md:py-32 px-6 text-center">
    <motion.p
      {...fadeUp(0)}
      className="text-[10px] uppercase tracking-[0.35em] text-[#3A4B40] font-outfit mb-10"
    >
      The Manifesto
    </motion.p>
    <motion.blockquote
      {...fadeUp(0.15)}
      className="font-serif-display text-2xl md:text-3xl lg:text-4xl font-light leading-[1.4] text-[#E8EAE3]/80 italic"
    >
      The modern wardrobe is a paradox — overflowing yet underwhelming. We
      believe that clarity, not abundance, is the true luxury. Vora exists to
      restore the quiet confidence of knowing exactly what to wear, every
      single morning.
    </motion.blockquote>
  </section>
);

export default WelcomeManifesto;
