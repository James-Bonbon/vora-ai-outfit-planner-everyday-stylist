import { motion } from "framer-motion";

const WelcomeHeader = () => (
  <motion.header
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1, delay: 0.2 }}
    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5"
  >
    <span className="font-serif-display text-2xl tracking-[0.25em] text-[#e8e6e1]/80">
      VORA
    </span>
    <span className="text-[9px] uppercase tracking-[0.3em] text-[#e8e6e1]/25 font-outfit hidden sm:block">
      By Invitation Only
    </span>
  </motion.header>
);

export default WelcomeHeader;
