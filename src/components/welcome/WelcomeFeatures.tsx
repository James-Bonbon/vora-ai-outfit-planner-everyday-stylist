import { motion } from "framer-motion";
import { fadeUp } from "./fadeAnimation";
import { Sparkles, ArrowRight, Bookmark, MessageCircle, ScanLine } from "lucide-react";

const features = [
  {
    label: "01 — The Digital Fitting Room",
    title: ["The Digital", "Fitting Room."],
    body: "Instantly visualize how pieces pair together before ever putting them on your body. Our virtual try-on renders photorealistic outfit combinations in seconds.",
    icon: ScanLine,
    placeholder: "Virtual Try-On",
  },
  {
    label: "02 — Automated Curation",
    title: ["Automated", "Curation."],
    body: "Point the Smart Camera at a garment. The AI identifies it, tags it, and automatically assigns it to its precise physical zone in your room.",
    icon: ArrowRight,
    placeholder: "Smart Camera",
  },
  {
    label: "03 — The Style Archive",
    title: ["The Style", "Archive."],
    body: "Save your favorite outfit combinations to a personal lookbook. Track the pieces you covet in a curated wishlist. Your aesthetic, catalogued.",
    icon: Bookmark,
    placeholder: "Lookbook & Wishlist",
  },
  {
    label: "04 — Conversational Styling",
    title: ["Conversational", "Styling."],
    body: "Text a world-class stylist who knows your wardrobe, calendar, and local weather. Ask what to wear tomorrow — and receive an answer built from the clothes you own.",
    icon: MessageCircle,
    placeholder: "AI Stylist Chat",
  },
  {
    label: "05 — Spatial Intelligence",
    title: ["Spatial", "Intelligence."],
    body: "Upload a photo. Our proprietary AI instantly maps the physical boundaries of your closet, creating an interactive, glass-pane layout of your actual room.",
    icon: Sparkles,
    placeholder: "AI Wardrobe Map",
  },
];

const WelcomeFeatures = () => (
  <section className="max-w-6xl mx-auto py-24 md:py-32 px-6 flex flex-col gap-32 md:gap-48">
    {features.map((feat, i) => {
      const isReversed = i % 2 !== 0;
      const Icon = feat.icon;

      return (
        <div
          key={feat.label}
          className={`flex flex-col ${isReversed ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-12 lg:gap-24`}
        >
          <div className="w-full md:w-1/2 text-left">
            <motion.p
              {...fadeUp(0)}
              className="text-[10px] uppercase tracking-[0.3em] text-[#e8e6e1]/30 font-outfit mb-4"
            >
              {feat.label}
            </motion.p>
            <motion.h2
              {...fadeUp(0.1)}
              className="font-serif-display font-light text-3xl md:text-5xl tracking-tight mb-6 leading-[1.1]"
            >
              {feat.title[0]}
              <br />
              <span className="italic">{feat.title[1]}</span>
            </motion.h2>
            <motion.p
              {...fadeUp(0.2)}
              className="font-outfit text-[#e8e6e1]/50 text-base md:text-lg leading-relaxed max-w-lg"
            >
              {feat.body}
            </motion.p>
          </div>

          <motion.div {...fadeUp(0.25)} className="w-full md:w-1/2">
            <div className="aspect-square rounded-2xl bg-[#e8e6e1]/[0.03] border border-[#e8e6e1]/[0.06] flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#e8e6e1]/[0.05] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#e8e6e1]/20" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#e8e6e1]/20 font-outfit">
                  {feat.placeholder}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      );
    })}
  </section>
);

export default WelcomeFeatures;
