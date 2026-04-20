import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, DollarSign, Palette, Crown, FileDown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GlassCard from "@/components/GlassCard";

// Dummy data - hardcoded as requested
const CATEGORY_VALUE_DATA = [
  { category: "Tops", value: 6800 },
  { category: "Bottoms", value: 4200 },
  { category: "Outerwear", value: 9500 },
  { category: "Shoes", value: 4000 },
];

// Dummy data - hardcoded as requested
const SUMMARY_STATS = [
  {
    icon: DollarSign,
    label: "Total Value",
    value: "$24,500",
    trend: "+12%",
  },
  {
    icon: Palette,
    label: "Most Worn Color",
    value: "Midnight Black",
    trend: "48% of wardrobe",
  },
  {
    icon: Crown,
    label: "Top Brand",
    value: "The Row",
    trend: "23 items",
  },
];

export default function StyleAnalytics() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success("Mock Report Generated!", {
        description: "Your Style DNA report is ready to download.",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sleek Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wardrobe
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Style Analytics</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My Style DNA</h1>
          <p className="mt-2 text-muted-foreground">
            Discover patterns and insights about your personal style.
          </p>
        </div>

        {/* Summary Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SUMMARY_STATS.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <GlassCard glowOnHover className="relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stat.trend}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Wardrobe Value by Category Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: SUMMARY_STATS.length * 0.12 + 0.15,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <GlassCard className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Wardrobe Value by Category
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Distribution of your wardrobe investment
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={CATEGORY_VALUE_DATA}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.4}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.75rem",
                    color: "hsl(var(--foreground))",
                    fontSize: "0.875rem",
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                />
                <Bar
                  dataKey="value"
                  fill="url(#barGradient)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </GlassCard>
        </motion.div>

        {/* Placeholder for future analytics content */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-4 h-12 w-12 text-primary/50" />
            <h2 className="text-lg font-medium">Coming Soon</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your style insights and analytics will appear here. Check back later for updates.
            </p>
          </div>
        </div>

        {/* Generate PDF Report CTA */}
        <div className="mt-8 flex justify-center pb-8">
          <Button
            size="lg"
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="min-w-[220px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Generate PDF Report
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
