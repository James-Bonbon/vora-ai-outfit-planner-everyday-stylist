import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";
import SuccessMessage from "./SuccessMessage";
import MagneticButton from "./MagneticButton";

interface Props {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  submitted: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const WelcomeFooterCTA = ({ email, setEmail, loading, submitted, onSubmit }: Props) => (
  <section className="min-h-[50vh] flex flex-col items-center justify-center text-center bg-foreground text-background py-24 px-6">
    <motion.p
      {...fadeUp(0)}
      className="text-[10px] uppercase tracking-[0.35em] text-background/30 font-outfit mb-6"
    >
      Batch 01 · Currently Reviewing Applications
    </motion.p>

    <motion.h2
      {...fadeUp(0.08)}
      className="font-serif-display font-light text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6"
    >
      Request <span className="italic">Early Access.</span>
    </motion.h2>

    <motion.p
      {...fadeUp(0.16)}
      className="font-outfit text-background/50 max-w-lg text-base md:text-lg leading-relaxed mb-10"
    >
      Spots for the private beta are strictly limited. Join the atelier.
    </motion.p>

    {!submitted ? (
      <motion.form
        {...fadeUp(0.24)}
        onSubmit={onSubmit}
        className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={loading}
          className="w-full sm:flex-1 bg-transparent border-b border-background/20 focus:border-background py-3 text-sm font-outfit text-background placeholder:text-background/30 focus:outline-none transition-colors disabled:opacity-40"
        />
        <MagneticButton
          type="submit"
          disabled={loading || !email}
          className="w-full sm:w-auto border border-background/60 text-background px-8 py-3 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium hover:bg-background hover:text-foreground transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Reserving…" : "Request Access"}
        </MagneticButton>
      </motion.form>
    ) : (
      <SuccessMessage inverted />
    )}

    <motion.p
      {...fadeUp(0.4)}
      className="mt-16 text-[10px] uppercase tracking-[0.35em] text-background/25 font-outfit"
    >
      By invitation only
    </motion.p>
  </section>
);

export default WelcomeFooterCTA;
