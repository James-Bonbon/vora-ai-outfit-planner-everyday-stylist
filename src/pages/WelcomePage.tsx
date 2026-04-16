import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WelcomeHeader from "@/components/welcome/WelcomeHeader";
import WelcomeHero from "@/components/welcome/WelcomeHero";
import WelcomeProcess from "@/components/welcome/WelcomeProcess";
import WelcomeFeatures from "@/components/welcome/WelcomeFeatures";
import WelcomeManifesto from "@/components/welcome/WelcomeManifesto";
import WelcomeFAQ from "@/components/welcome/WelcomeFAQ";
import WelcomeFooterCTA from "@/components/welcome/WelcomeFooterCTA";
import WelcomeContactSection from "@/components/welcome/WelcomeContactSection";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import { type WelcomeThemeKey, WELCOME_THEME_CLASS_MAP } from "@/components/welcome/WelcomeThemeSwitcher";

const WelcomePage = () => {
  const [footerEmail, setFooterEmail] = useState("");
  const [footerLoading, setFooterLoading] = useState(false);
  const [footerSubmitted, setFooterSubmitted] = useState(false);

  const [activeTheme, setActiveTheme] = useState<WelcomeThemeKey>("default");

  const handleSubmit = async (
    e: React.FormEvent,
    emailValue: string,
    setLoadingFn: (v: boolean) => void,
    setSubmittedFn: (v: boolean) => void
  ) => {
    e.preventDefault();
    if (!emailValue || !emailValue.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoadingFn(true);
    try {
      const { data, error } = await supabase.functions.invoke("join-waitlist", {
        body: { email: emailValue },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmittedFn(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingFn(false);
    }
  };

  const themeClass = WELCOME_THEME_CLASS_MAP[activeTheme];

  return (
    <div
      className={`min-h-screen bg-background text-foreground selection:bg-foreground/20 transition-colors duration-700 ${themeClass}`}
    >
      <WelcomeHeader activeTheme={activeTheme} onThemeChange={setActiveTheme} />
      <WelcomeHero />
      <WelcomeProcess />
      <WelcomeFeatures />
      <WelcomeManifesto />
      <WelcomeFAQ />
      <WelcomeFooterCTA
        email={footerEmail}
        setEmail={setFooterEmail}
        loading={footerLoading}
        submitted={footerSubmitted}
        onSubmit={(e) => handleSubmit(e, footerEmail, setFooterLoading, setFooterSubmitted)}
      />
      <WelcomeContactSection />
      <WelcomeFooter />
    </div>
  );
};

export default WelcomePage;
