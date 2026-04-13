import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";

const steps = [
  { number: "01", title: "Capture", description: "Photograph your space. Our AI does the rest." },
  { number: "02", title: "Understand", description: "Every garment is identified, tagged, and mapped." },
  { number: "03", title: "Dress", description: "Receive curated outfits built from what you already own." },
];

const WelcomeProcess = () => (
  <section className="max-w-5xl mx-auto py-24 md:py-32 px-6">
    <motion.p
      {...fadeUp(0)}
      className="text-center text-[10px] uppercase tracking-[0.35em] text-[#e8e6e1]/30 font-outfit mb-16"
    >
      The Process
    </motion.p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
      {steps.map((step, i) => (
        <motion.div key={step.number} {...fadeUp(i * 0.12)} className="text-center">
          <p className="font-serif-display text-5xl md:text-6xl font-light text-[#e8e6e1]/10 mb-4">
            {step.number}
          </p>
          <h3 className="font-serif-display text-2xl md:text-3xl font-light italic mb-3 text-[#e8e6e1]">
            {step.title}
          </h3>
          <p className="font-outfit text-sm text-[#e8e6e1]/40 max-w-xs mx-auto leading-relaxed">
            {step.description}
          </p>
        </motion.div>
      ))}
    </div>
  </section>
);

export default WelcomeProcess;
