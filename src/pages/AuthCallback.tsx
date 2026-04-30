import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Stable post-auth landing route. OAuth providers redirect here, then we
 * internally navigate to the originally requested deep path stored in
 * sessionStorage. Keeping the OAuth redirect URI shallow (`/auth/callback`)
 * avoids preview-environment failures with deep callback paths.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    let target = "/home";
    try {
      const stored = sessionStorage.getItem("vora_post_login_redirect");
      if (stored) {
        target = stored;
        sessionStorage.removeItem("vora_post_login_redirect");
      }
    } catch {}

    // If we somehow arrived here without a session, send to login (preserving target).
    if (!user) {
      const redirectTo = encodeURIComponent(target);
      navigate(`/login?redirectTo=${redirectTo}`, { replace: true });
      return;
    }

    navigate(target, { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground animate-pulse">Signing you in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
