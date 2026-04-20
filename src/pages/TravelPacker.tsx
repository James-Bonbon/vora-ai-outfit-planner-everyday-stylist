import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Luggage, Check, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Hardcoded mock packing list
const INITIAL_ITEMS = [
  { id: "1", name: "The Row Cashmere Sweater", category: "Knitwear", checked: true },
  { id: "2", name: "Loewe Tailored Trousers", category: "Bottoms", checked: true },
  { id: "3", name: "Khaite Silk Slip Dress", category: "Dresses", checked: true },
  { id: "4", name: "Toteme Wool Overcoat", category: "Outerwear", checked: false },
  { id: "5", name: "The Row Leather Loafers", category: "Footwear", checked: false },
];

const PROGRESS = 60;

export default function TravelPacker() {
  const navigate = useNavigate();
  const [items, setItems] = useState(INITIAL_ITEMS);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
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
            <Luggage className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Travel Packer</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trip
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Weekend Getaway</h1>
          <p className="mt-2 text-muted-foreground">
            A curated capsule for three days away.
          </p>
        </div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Packing Progress
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {PROGRESS}% Packed
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${PROGRESS}%` }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </motion.div>

        {/* Checklist */}
        <ul className="space-y-2">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.25 + index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <button
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all",
                  "hover:border-primary/40 hover:shadow-sm",
                  item.checked && "bg-card/60"
                )}
              >
                {/* Custom Checkbox */}
                <div
                  className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    item.checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent text-transparent group-hover:border-primary/60"
                  )}
                >
                  {item.checked ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Circle className="h-4 w-4 opacity-0" />
                  )}
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm font-medium transition-all",
                      item.checked && "text-muted-foreground line-through"
                    )}
                  >
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.category}
                  </p>
                </div>
              </button>
            </motion.li>
          ))}
        </ul>
      </main>
    </div>
  );
}
