import { motion } from "framer-motion";
import { Check } from "lucide-react";

const SuccessMessage = ({ inverted = false }: { inverted?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6 }}
    className="flex flex-col items-center gap-4"
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${inverted ? "bg-[#0a0a0a]/10" : "bg-[#e8e6e1]/10"}`}>
      <Check className={`w-5 h-5 ${inverted ? "text-[#0a0a0a]" : "text-[#e8e6e1]"}`} />
    </div>
    <p className={`text-lg font-medium font-serif-display ${inverted ? "text-[#0a0a0a]" : "text-[#e8e6e1]"}`}>
      You are on the list.
    </p>
    <p className={`text-sm ${inverted ? "text-[#0a0a0a]/60" : "text-[#e8e6e1]/50"}`}>
      Check your inbox for your early access ticket.
    </p>
  </motion.div>
);

export default SuccessMessage;
