import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children, skipOnboarding = false }: { children: React.ReactNode; skipOnboarding?: boolean }) => {
  const { user, loading } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  useEffect(() => {
    if (!user || skipOnboarding) {
      setOnboardingChecked(true);
      return;
    }
    supabase
      .from("profiles")
      .select("onboarding_complete, username, selfie_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const complete = data?.onboarding_complete === true && !!data?.username && !!data?.selfie_url;
        setOnboardingComplete(complete);
        setOnboardingChecked(true);
      });
  }, [user, skipOnboarding]);

  if (loading || (user && !onboardingChecked)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
