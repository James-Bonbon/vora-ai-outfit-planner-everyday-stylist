import { useNavigate } from "react-router-dom";
import { ArrowLeft, Palette, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Hardcoded "Winter Minimalist" palette
const PALETTE = [
  { name: "Midnight Blue", hex: "#1B2A4E" },
  { name: "Charcoal", hex: "#36454F" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Sage", hex: "#9CAF88" },
];

export default function ColorDNA() {
  const navigate = useNavigate();

  const handleCopy = () => {
    toast.success("Hex codes copied!", {
      description: "Your Winter Minimalist palette is on your clipboard.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Color DNA</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">My Color DNA</h1>
          <p className="mt-2 text-muted-foreground">
            Your personalized "Winter Minimalist" palette.
          </p>
        </div>

        {/* Palette Grid */}
        <div className="mb-10 grid grid-cols-5 gap-3 sm:gap-4">
          {PALETTE.map((color, index) => (
            <motion.div
              key={color.hex}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: index * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="aspect-square w-full rounded-2xl border border-border/60 shadow-md"
                style={{ backgroundColor: color.hex }}
                aria-label={color.name}
              />
              <div className="text-center">
                <p className="truncate text-xs font-medium">{color.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {color.hex}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex justify-center pb-8">
          <Button size="lg" onClick={handleCopy} className="min-w-[240px]">
            <Copy className="h-4 w-4" />
            Copy Palette to Clipboard
          </Button>
        </div>
      </main>
    </div>
  );
}
