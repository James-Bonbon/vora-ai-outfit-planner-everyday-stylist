import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";
import { useState } from "react";

const faqs = [
  {
    q: "What exactly is this AI outfit planner?",
    a: "Vora is a personal styling intelligence. It learns your wardrobe, understands your preferences, reads your calendar, and checks the local weather — then curates complete outfits for every occasion, built entirely from the clothes you already own.",
  },
  {
    q: "Do I need to digitize my entire wardrobe at once?",
    a: "Not at all. Start with five favorite pieces. Our AI builds around what you give it and grows smarter with every garment you add. There is no minimum and no rush.",
  },
  {
    q: "Can I plan outfits for different occasions?",
    a: "Absolutely. From Monday board meetings to weekend getaways and black-tie evenings — Vora tailors every suggestion to the context of your day, including weather and dress code.",
  },
  {
    q: "How accurate are the styling suggestions?",
    a: "The AI refines its taste with every outfit you accept, adjust, or dismiss. Over time it develops an intimate understanding of your personal aesthetic — think of it as a stylist who never forgets.",
  },
  {
    q: "Will there be a mobile app?",
    a: "Vora is already available as a Progressive Web App — install it directly to your home screen on iOS or Android for a native-like experience, no app store required. A dedicated native app is on the roadmap.",
  },
];

const WelcomeFAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="max-w-3xl mx-auto py-24 md:py-32 px-6">
      <motion.p
        {...fadeUp(0)}
        className="text-center text-[10px] uppercase tracking-[0.35em] text-[#3A4B40] font-outfit mb-16"
      >
        The Concierge
      </motion.p>

      <div className="flex flex-col divide-y divide-[#3A4B40]/30">
        {faqs.map((faq, i) => (
          <motion.div key={i} {...fadeUp(i * 0.08)}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full text-left py-6 flex items-start justify-between gap-4 group"
            >
              <span className="font-outfit text-base md:text-lg text-[#E8EAE3]/80 group-hover:text-[#E8EAE3] transition-colors">
                {faq.q}
              </span>
              <span className="font-outfit text-[#3A4B40] text-xl leading-none mt-0.5 shrink-0 transition-transform duration-300"
                style={{ transform: openIndex === i ? "rotate(45deg)" : "rotate(0deg)" }}
              >
                +
              </span>
            </button>
            <div
              className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              style={{ maxHeight: openIndex === i ? "200px" : "0px", opacity: openIndex === i ? 1 : 0 }}
            >
              <p className="font-outfit text-sm text-[#E8EAE3]/40 leading-relaxed pb-6 max-w-2xl">
                {faq.a}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default WelcomeFAQ;
