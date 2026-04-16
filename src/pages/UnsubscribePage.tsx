import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "checking" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data?.error ?? "Invalid token");
          setState("invalid");
          return;
        }
        if (data?.valid === false && data?.reason === "already_unsubscribed") {
          setState("already");
        } else if (data?.valid) {
          setState("ready");
        } else {
          setState("invalid");
        }
      } catch (err: any) {
        setErrorMsg(err.message ?? "Network error");
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setState("done");
      else if (data?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to unsubscribe");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center py-20">
        <p className="text-[10px] uppercase tracking-[0.35em] text-foreground/40 font-outfit mb-6">
          VORA
        </p>

        {state === "checking" && (
          <p className="font-outfit text-foreground/60">Checking your link…</p>
        )}

        {state === "ready" && (
          <>
            <h1 className="font-serif-display font-light text-3xl mb-4">
              Unsubscribe from emails?
            </h1>
            <p className="font-outfit text-foreground/60 mb-10">
              You'll stop receiving messages from VORA at this address.
            </p>
            <button
              onClick={confirm}
              className="border border-foreground/60 text-foreground px-10 py-3 uppercase tracking-[0.2em] text-[10px] font-outfit font-medium hover:bg-foreground hover:text-background transition-colors duration-300"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {state === "submitting" && (
          <p className="font-outfit text-foreground/60">Processing…</p>
        )}

        {state === "done" && (
          <>
            <h1 className="font-serif-display font-light text-3xl mb-4">You're unsubscribed.</h1>
            <p className="font-outfit text-foreground/60">
              We won't email you again. You can always reach us if you change your mind.
            </p>
          </>
        )}

        {state === "already" && (
          <>
            <h1 className="font-serif-display font-light text-3xl mb-4">Already unsubscribed.</h1>
            <p className="font-outfit text-foreground/60">
              This email has already been removed from our list.
            </p>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <h1 className="font-serif-display font-light text-3xl mb-4">Link not valid.</h1>
            <p className="font-outfit text-foreground/60">
              {errorMsg || "This unsubscribe link is invalid or has expired."}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default UnsubscribePage;
