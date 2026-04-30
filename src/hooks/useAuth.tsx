import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearUrlCache } from "@/utils/urlCache";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          clearUrlCache();
        } else {
          setSession(session);
          setUser(session?.user ?? null);

          if (event === "SIGNED_IN") {
            const path = window.location.pathname;
            const isAuthRoute = path === "/" || path === "/welcome" || path === "/login" || path === "/auth" || path === "/auth/callback";
            if (isAuthRoute) {
              let target = "/home";
              try {
                const stored = sessionStorage.getItem("vora_post_login_redirect");
                if (stored) {
                  target = stored;
                  sessionStorage.removeItem("vora_post_login_redirect");
                }
              } catch {}
              window.location.replace(target);
            }
          }
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    clearUrlCache();
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
