import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
    <div className="flex items-center gap-4 md:gap-6">
      <Link
        to="/login"
        className="text-[10px] uppercase tracking-[0.25em] font-outfit font-medium text-foreground/70 hover:text-foreground transition-colors whitespace-nowrap"
      >
        Sign in
      </Link>
      <WelcomeThemeSwitcher active={activeTheme} onChange={onThemeChange} />
    </div>
  </motion.header>
);

export default WelcomeHeader;
