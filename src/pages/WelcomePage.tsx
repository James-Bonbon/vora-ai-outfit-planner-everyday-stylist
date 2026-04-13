import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import WelcomeHeader from "@/components/welcome/WelcomeHeader";
import WelcomeHero from "@/components/welcome/WelcomeHero";
import WelcomeProcess from "@/components/welcome/WelcomeProcess";
import WelcomeFeatures from "@/components/welcome/WelcomeFeatures";
import WelcomeManifesto from "@/components/welcome/WelcomeManifesto";
import WelcomeFAQ from "@/components/welcome/WelcomeFAQ";
import WelcomeFooterCTA from "@/components/welcome/WelcomeFooterCTA";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";

const WelcomePage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [footerEmail, setFooterEmail] = useState("");
  const [footerLoading, setFooterLoading] = useState(false);
  const [footerSubmitted, setFooterSubmitted] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e6e1] selection:bg-[#e8e6e1]/20">
      <WelcomeHeader />
      <WelcomeHero
        email={email}
        setEmail={setEmail}
        loading={loading}
        submitted={submitted}
        onSubmit={(e) => handleSubmit(e, email, setLoading, setSubmitted)}
      />
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
      <WelcomeFooter />
    </div>
  );
};

export default WelcomePage;
