import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; // Make sure this path matches where your useAuth file is!
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({
  children,
  skipOnboarding = false,
}: {
  children: React.ReactNode;
  skipOnboarding?: boolean;
}) => {
  const { user, loading } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // 1. We changed the default to 'false' so it fails safely!
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    // 2. STRICT GUARD: Do absolutely nothing until the auth hook finishes its initial load
    if (loading) return;

    // 3. If there is no user, or we are explicitly skipping, we are done checking
    if (!user || skipOnboarding) {
      setOnboardingChecked(true);
      return;
    }

    // 4. Safely fetch the profile only when we know the user exists
    supabase
      .from("profiles")
      .select("onboarding_complete, username, selfie_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching profile:", error);
        const complete = data?.onboarding_complete === true && !!data?.username;
        setOnboardingComplete(complete);
        setOnboardingChecked(true);
      }, (err) => {
        console.error("Profile fetch failed:", err);
        setOnboardingChecked(true);
      });
  }, [user, loading, skipOnboarding]);

  // 5. Added visible text so if it hangs, you know exactly why
  if (loading || (user && !onboardingChecked)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // 6. Ensure skipOnboarding properly bypasses this redirect
  if (!onboardingComplete && !skipOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
