import { motion } from "framer-motion";
import { Check } from "lucide-react";

const SuccessMessage = ({ inverted = false }: { inverted?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6 }}
    className="flex flex-col items-center gap-4"
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${inverted ? "bg-background/10" : "bg-foreground/10"}`}>
      <Check className={`w-5 h-5 ${inverted ? "text-background" : "text-foreground"}`} />
    </div>
    <p className={`text-lg font-medium font-serif-display ${inverted ? "text-background" : "text-foreground"}`}>
      You are on the list.
    </p>
    <p className={`text-sm ${inverted ? "text-background/60" : "text-foreground/50"}`}>
      Check your inbox for your early access ticket.
    </p>
  </motion.div>
);

export default SuccessMessage;
