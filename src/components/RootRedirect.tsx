import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Auth-aware root route. Signed-in users go to /home; signed-out users go
 * to /login. The Welcome page is intentionally NOT rendered here — it lives
 * at /welcome (and /waitlist) as a standalone public marketing page.
 */
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={user ? "/home" : "/login"} replace />;
};

export default RootRedirect;
