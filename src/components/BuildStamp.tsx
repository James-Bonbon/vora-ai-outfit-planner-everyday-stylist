import { useEffect, useMemo, useState } from "react";

const getRuntimeEnvironment = () => {
  if (typeof window === "undefined") return "unknown";

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isLovablePreview = /^id-preview--[a-f0-9-]+\.lovable\.app$/i.test(host);

  if (isLovablePreview) return "preview";
  if (isLocal || import.meta.env.DEV) return "local";
  return "published";
};

const BuildStamp = () => {
  const [cacheStatus, setCacheStatus] = useState("checking cache");
  const environment = useMemo(getRuntimeEnvironment, []);
  const shouldShowBuildStamp = environment === "preview" || environment === "local";

  useEffect(() => {
    if (typeof window === "undefined" || environment !== "preview") {
      setCacheStatus("cache check skipped");
      return;
    }

    let mounted = true;

    const clearPreviewCaches = async () => {
      try {
        const registrations = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all(registrations?.map((registration) => registration.unregister()) ?? []);

        const cacheNames = await window.caches?.keys?.();
        await Promise.all(cacheNames?.map((name) => window.caches.delete(name)) ?? []);

        if (mounted) setCacheStatus("preview cache cleared");
      } catch {
        if (mounted) setCacheStatus("cache clear unavailable");
      }
    };

    clearPreviewCaches();

    return () => {
      mounted = false;
    };
  }, [environment]);

  if (!shouldShowBuildStamp) return null;

  return (
    <aside
      aria-label="Build version"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-md border border-border/80 bg-background/90 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground shadow-sm backdrop-blur"
    >
      <div className="font-medium text-foreground">Build {__COMMIT_SHA__}</div>
      <div>{new Date(__BUILD_TIMESTAMP__).toLocaleString()}</div>
      <div>{environment} · {__GIT_BRANCH__}</div>
      <div>{cacheStatus}</div>
    </aside>
  );
};

export default BuildStamp;