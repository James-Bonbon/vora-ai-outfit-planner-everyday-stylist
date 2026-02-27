import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const THEME_CLASS_MAP: Record<string, string> = {
  default: "",
  forest: "theme-forest",
  navy: "theme-navy",
  rose: "theme-rose",
  cream: "theme-cream",
  peach: "theme-peach",
};

const CACHE_KEY = "vora_app_theme";

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Apply cached theme immediately to avoid flash
    const cached = localStorage.getItem(CACHE_KEY) || "default";
    applyTheme(cached);

    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("app_theme")
        .eq("user_id", user.id)
        .maybeSingle();

      const theme = (data as any)?.app_theme || "default";
      localStorage.setItem(CACHE_KEY, theme);
      applyTheme(theme);
    })();
  }, [user]);

  return <>{children}</>;
};

function applyTheme(theme: string) {
  const root = document.documentElement;

  // Remove all custom theme classes
  Object.values(THEME_CLASS_MAP).forEach((cls) => {
    if (cls) root.classList.remove(cls);
  });

  // Manage Tailwind's dark class
  const lightThemes = ["rose", "cream", "peach"];
  if (lightThemes.includes(theme)) {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }

  // Apply new theme class
  const cls = THEME_CLASS_MAP[theme];
  if (cls) root.classList.add(cls);
}

export { applyTheme, THEME_CLASS_MAP };
export default ThemeProvider;
