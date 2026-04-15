import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const wordVariants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const manifestoText =
  "The modern wardrobe is a paradox — overflowing yet underwhelming. We believe that clarity, not abundance, is the true luxury. Vora exists to restore the quiet confidence of knowing exactly what to wear, every single morning.";

const WelcomeManifesto = () => {
  const words = manifestoText.split(" ");

  return (
    <section className="max-w-3xl mx-auto py-24 md:py-32 px-6 text-center">
      <motion.p
        {...fadeUp(0)}
        className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-outfit mb-10"
      >
        The Manifesto
      </motion.p>
      <motion.blockquote
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        className="font-serif-display text-2xl md:text-3xl lg:text-4xl font-light leading-[1.4] text-foreground/80 italic"
      >
        {words.map((word, index) => (
          <motion.span
            key={index}
            variants={wordVariants}
            className="inline-block"
            style={{ whiteSpace: "pre" }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </motion.blockquote>
    </section>
  );
};

export default WelcomeManifesto;
