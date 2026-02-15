import { Home, ShoppingBag, Scan, Sparkles, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/wardrobe", label: "Wardrobe", icon: ShoppingBag },
  { path: "/mirror", label: "Mirror", icon: Scan },
  { path: "/beauty", label: "Beauty", icon: Sparkles },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card-strong border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] rounded-xl transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-1 w-6 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
