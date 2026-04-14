import { cn } from "@/lib/utils";

const WELCOME_THEMES = [
  { key: "default", label: "Noir", swatch: "hsl(220 15% 8%)" },
  { key: "forest", label: "Forest", swatch: "hsl(138 15% 20%)" },
  { key: "navy", label: "Navy", swatch: "hsl(213 28% 14%)" },
  { key: "rose", label: "Rosé", swatch: "hsl(348 52% 75%)" },
  { key: "cream", label: "Cream", swatch: "hsl(34 12% 61%)" },
  { key: "peach", label: "Peach", swatch: "hsl(22 66% 73%)" },
] as const;

export type WelcomeThemeKey = (typeof WELCOME_THEMES)[number]["key"];

export const WELCOME_THEME_CLASS_MAP: Record<WelcomeThemeKey, string> = {
  default: "",
  forest: "theme-forest",
  navy: "theme-navy",
  rose: "theme-rose",
  cream: "theme-cream",
  peach: "theme-peach",
};

interface Props {
  active: WelcomeThemeKey;
  onChange: (key: WelcomeThemeKey) => void;
}

const WelcomeThemeSwitcher = ({ active, onChange }: Props) => (
  <div className="flex items-center backdrop-blur-md bg-white/5 border border-white/10 rounded-full px-4 py-2 gap-3">
    <span className="text-[10px] uppercase tracking-widest opacity-50 mr-2 hidden md:block font-outfit text-foreground">
      Preview App Themes
    </span>
    {WELCOME_THEMES.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        aria-label={`Switch to ${t.label} theme`}
        className={cn(
          "w-4 h-4 rounded-full transition-transform duration-300 hover:scale-110 shrink-0",
          active === t.key && "ring-1 ring-offset-2 ring-offset-transparent ring-foreground/50 scale-110"
        )}
        style={{ backgroundColor: t.swatch }}
      />
    ))}
  </div>
);

export default WelcomeThemeSwitcher;
