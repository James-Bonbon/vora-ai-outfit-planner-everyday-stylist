import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";
import SuccessMessage from "./SuccessMessage";

interface Props {
  email: string;
  setEmail: (v: string) => void;
  loading: boolean;
  submitted: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const WelcomeHero = ({ email, setEmail, loading, submitted, onSubmit }: Props) => (
  <section className="min-h-[85vh] flex flex-col items-center justify-center text-center px-6">
    <motion.p
      {...fadeUp(0)}
      className="font-outfit text-xs uppercase tracking-[0.35em] text-[#e8e6e1]/40 mb-12"
    >
      VORA
    </motion.p>

    <motion.h1
      {...fadeUp(0.15)}
      className="font-serif-display font-light text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6 max-w-4xl"
    >
      Your Wardrobe,
      <br />
      <span className="italic">Mastered</span> by AI.
    </motion.h1>

    <motion.p
      {...fadeUp(0.3)}
      className="font-outfit text-[#e8e6e1]/50 max-w-2xl text-base md:text-lg lg:text-xl leading-relaxed mb-14"
    >
      Stop staring at a closet full of clothes with nothing to wear.
      We are digitizing your physical space with advanced spatial AI.
    </motion.p>

    {!submitted ? (
      <motion.form
        {...fadeUp(0.45)}
        onSubmit={onSubmit}
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

    <motion.div
      {...fadeUp(0.7)}
      className="mt-20 flex flex-col items-center gap-2 text-[#e8e6e1]/20"
    >
      <span className="text-[10px] uppercase tracking-[0.3em] font-outfit">Discover</span>
      <div className="w-px h-8 bg-[#e8e6e1]/10" />
    </motion.div>
  </section>
);

export default WelcomeHero;
