import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import WelcomeThemeSwitcher, { type WelcomeThemeKey } from "./WelcomeThemeSwitcher";

interface Props {
  activeTheme: WelcomeThemeKey;
  onThemeChange: (key: WelcomeThemeKey) => void;
}

const WelcomeHeader = ({ activeTheme, onThemeChange }: Props) => (
  <motion.header
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1, delay: 0.2 }}
    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5"
  >
    <span className="font-serif-display text-2xl tracking-[0.25em] text-foreground/80">
      VORA
    </span>
    <WelcomeThemeSwitcher active={activeTheme} onChange={onThemeChange} />
  </motion.header>
);

export default WelcomeHeader;
