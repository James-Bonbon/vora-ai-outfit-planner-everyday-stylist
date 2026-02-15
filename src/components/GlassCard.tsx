import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowOnHover?: boolean;
  onClick?: () => void;
}

const GlassCard = ({ children, className, glowOnHover = false, onClick }: GlassCardProps) => {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(
        "glass-card rounded-2xl p-4",
        glowOnHover && "transition-shadow duration-300 hover:glow-lime",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
