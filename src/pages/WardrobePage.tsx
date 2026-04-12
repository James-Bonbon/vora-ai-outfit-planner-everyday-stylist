import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Plus, Library, Camera, Loader2, WashingMachine, AlertTriangle, Grid, Shirt, Server, User, ShoppingBag } from "lucide-react";
import CabinetIcon from "@/components/icons/CabinetIcon";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AddItemSheet from "@/components/wardrobe/AddItemSheet";
import type { PrefillData } from "@/components/wardrobe/AddItemSheet";
import GarmentDetailSheet from "@/components/wardrobe/GarmentDetailSheet";
import SmartCamera from "@/components/wardrobe/SmartCamera";
import type { AnalyzedItem } from "@/components/wardrobe/SmartCamera";
import type { ClosetItem, DreamItem, GarmentDisplay, Wardrobe } from "@/types/wardrobe";
import WardrobeViewer from "@/components/wardrobe/WardrobeViewer";
import { LookbookTab } from "@/components/wardrobe/LookbookTab";
import { normalizeToPng } from "@/utils/imageProcessing";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CATEGORIES = ["All", "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"];
const NETWORK_DEBUG_TIMEOUT_MS = 30000;

type TabValue = "closet" | "lookbook" | "dream";

const isUsableEnvValue = (value: unknown) => {
  return typeof value === "string" && value.trim() !== "" && value.trim().toLowerCase() !== "undefined";
};

const maskHeaderValue = (key: string, value: string) => {
  if (!/authorization|apikey|api-key|token/i.test(key)) return value;
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 8)}...[redacted]...${value.slice(-4)}`;
};

const getDebugHeaders = (input: RequestInfo | URL, init?: RequestInit) => {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const headers = new Headers(request?.headers);

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const headersForLog: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersForLog[key] = maskHeaderValue(key, value);
  });
  return headersForLog;
};

const getDebugFetchUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const installWardrobeFetchDebugLogger = () => {
  if (typeof window === "undefined") return () => undefined;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
    const url = getDebugFetchUrl(input);
    const method = init?.method ?? request?.method ?? "GET";
    const startedAt = performance.now();

    console.groupCollapsed(`[Wardrobe fetch debug] ${method} ${url}`);
    console.log("Request:", {
      url,
      method,
      headers: getDebugHeaders(input, init),
      bodyType: init?.body ? Object.prototype.toString.call(init.body) : "none",
    });
    console.groupEnd();

    try {
      const response = await originalFetch(input, init);
      console.log("[Wardrobe fetch debug] response", {
        url,
        status: response.status,
        ok: response.ok,
        type: response.type,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return response;
    } catch (error) {
      console.error("[Wardrobe fetch debug] failed before readable response", {
        url,
        elapsedMs: Math.round(performance.now() - startedAt),
        online: navigator.onLine,
        error,
      });
      throw error;
    }
  };

  return () => {
    window.fetch = originalFetch;
  };
};

const withDebugTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string, onTimeout?: () => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new DOMException(`${label} timed out after ${timeoutMs / 1000} seconds`, "AbortError"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const WardrobePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("closet");
  const [activeCategory, setActiveCategory] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [bulkQueue, setBulkQueue] = useState<AnalyzedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GarmentDisplay | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Smart Laundry state
  const [needsLaundryReview, setNeedsLaundryReview] = useState<ClosetItem[]>([]);

  // Wardrobe Map state
  const [mapOpen, setMapOpen] = useState(false);
  const [closetSvg, setClosetSvg] = useState<string | null>(null);
  const [generatingMap, setGeneratingMap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing SVG
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("closet_svg")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setClosetSvg(data?.closet_svg ?? null);
      });
  }, [user]);

  const previewWardrobe = useMemo<Wardrobe | null>(() => {
    if (!closetSvg) return null;

    return {
      id: "ai-wardrobe-preview",
      title: "AI Wardrobe Map",
      views: [
        {
          id: "generated-view",
          name: "Current View",
          imageUrl: "/placeholder.svg",
          svgString: closetSvg,
        },
      ],
    };
  }, [closetSvg]);

  const clearStoredClosetSvg = async () => {
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ closet_svg: null }).eq("user_id", user.id);

    if (error) throw error;
  };

  const openClosetPhotoPicker = (wipeCurrentSvg = false) => {
    if (wipeCurrentSvg) {
      setClosetSvg(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleClosetPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const toastId = "wardrobe-upload";
    let restoreFetchDebugLogger: (() => void) | undefined;
    const getErrorMessage = (error: any) => {
      if (error?.name === "FunctionsFetchError") {
        const contextMessage = error?.context?.message ?? error?.context?.cause?.message ?? error?.context?.name ?? "";

        return [
          "Browser/network failed before the Edge Function returned a readable response.",
          contextMessage ? `Fetch detail: ${contextMessage}.` : "",
          "Check DevTools Network for CORS preflight, DNS, or offline failures.",
        ]
          .filter(Boolean)
          .join(" ");
      }

      const rawMessage =
        error?.message ??
        (typeof error === "string" ? error : JSON.stringify(error, Object.getOwnPropertyNames(error)));

      if (error?.name === "AbortError" || /aborted|timeout/i.test(rawMessage ?? "")) {
        return "Request timed out after 30 seconds";
      }

      return rawMessage || "Unknown error";
    };

    setGeneratingMap(true);
    setClosetSvg(null);
    toast.loading("Analyzing wardrobe layout...", { id: toastId });

    try {
      restoreFetchDebugLogger = installWardrobeFetchDebugLogger();

      console.log("[Wardrobe map debug] Clearing stored closet SVG before invoking Edge Function...");
      await withDebugTimeout(clearStoredClosetSvg(), NETWORK_DEBUG_TIMEOUT_MS, "Clearing stored closet SVG");
      console.log("[Wardrobe map debug] Stored closet SVG cleared.");

      const normalizedBlob = await normalizeToPng(file);
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(normalizedBlob);
      });

      const supabaseUrlExists = Boolean(import.meta.env.VITE_SUPABASE_URL);
      const supabaseAnonKeyExists = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      const supabasePublishableKeyExists = Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseFunctionsUrl = isUsableEnvValue(supabaseUrl)
        ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1`
        : undefined;
      const supabaseUrlLooksValid = isUsableEnvValue(supabaseUrl) && /^https?:\/\//i.test(supabaseUrl);
      const supabaseKeyLooksValid =
        isUsableEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
        isUsableEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

      console.log("Supabase env debug:", {
        supabaseUrl,
        supabaseFunctionsUrl,
        supabaseUrlExists,
        supabaseUrlLooksValid,
        supabaseAnonKeyExists,
        supabasePublishableKeyExists,
      });
      console.log("Base64 length:", base64.length);

      if (!supabaseUrlLooksValid || !supabaseKeyLooksValid) {
        throw new Error("Supabase client config is missing.");
      }

      if (!base64 || base64.length < 100) {
        throw new Error("Invalid image data. Please try again.");
      }

      console.log("[Wardrobe map debug] Invoking Edge Function", {
        functionName: "generate-wardrobe-svg",
        expectedUrl: `${supabaseFunctionsUrl}/generate-wardrobe-svg`,
      });

      const invokeController = new AbortController();
      const { data, error } = await withDebugTimeout(
        supabase.functions.invoke("generate-wardrobe-svg", {
          body: { imageBase64: base64 },
          signal: invokeController.signal,
          timeout: NETWORK_DEBUG_TIMEOUT_MS,
        } as any),
        NETWORK_DEBUG_TIMEOUT_MS,
        "generate-wardrobe-svg",
        () => invokeController.abort(),
      );

      console.log("Raw Supabase Response:", { data, error });

      if (error) {
        throw new Error(getErrorMessage(error));
      }

      if (data?.error) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }

      if (!data?.svg) {
        throw new Error("API Success, but no SVG returned!");
      }

      // Sanitize SVG to be CSP-safe: strip script tags, event handlers, and foreign objects
      let sanitizedSvg = data.svg
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
        .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
        .replace(/\bon\w+\s*=\s*'[^']*'/gi, "")
        .replace(/javascript\s*:/gi, "blocked:")
        .trim();

      console.log("[Wardrobe map] Sanitized SVG length:", sanitizedSvg.length);

      setClosetSvg(sanitizedSvg);
      toast.success("Map generated!", { id: toastId });
    } catch (err: any) {
      console.error("Full Network Error Object:", err);
      toast.error("Failed: " + getErrorMessage(err), { id: toastId });
    } finally {
      restoreFetchDebugLogger?.();
      input.value = "";
      setGeneratingMap(false);
    }
  };

  const { data: closetData, isLoading: isClosetLoading } = useQuery({
    queryKey: ["closet", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closet_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return { items: [] as ClosetItem[], imageUrls: {} as Record<string, string> };

      const urls: Record<string, string> = {};
      const paths = data.map((item) => item.image_url).filter(Boolean);

      if (paths.length > 0) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from("garments")
          .createSignedUrls(paths, 3600);
        if (!urlError && urlData) {
          urlData.forEach((u, index) => {
            if (u.signedUrl) urls[data[index].id] = u.signedUrl;
          });
        }
      }
      return { items: data as ClosetItem[], imageUrls: urls };
    },
  });

  const { data: dreamItems = [], isLoading: isDreamLoading } = useQuery({
    queryKey: ["dream", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dream_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as DreamItem[]) ?? [];
    },
  });

  const items = closetData?.items ?? [];
  const imageUrls = closetData?.imageUrls ?? {};
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  // Smart Laundry: detect stale items (7+ days in laundry)
  useEffect(() => {
    if (!items.length) {
      setNeedsLaundryReview([]);
      return;
    }
    const now = new Date();
    const staleItems = items.filter((item: any) => {
      if (!item.is_in_laundry || !item.laundry_added_at) return false;
      const daysInLaundry = (now.getTime() - new Date(item.laundry_added_at).getTime()) / (1000 * 3600 * 24);
      if (daysInLaundry < 7) return false;
      if (!item.last_laundry_reminder_at) return true;
      const daysSinceReminder =
        (now.getTime() - new Date(item.last_laundry_reminder_at).getTime()) / (1000 * 3600 * 24);
      return daysSinceReminder >= 3;
    });
    setNeedsLaundryReview(staleItems);
  }, [items]);

  const handleToggleLaundry = async (item: ClosetItem, isNowDirty: boolean) => {
    const payload = isNowDirty
      ? { is_in_laundry: true, laundry_added_at: new Date().toISOString(), last_laundry_reminder_at: null }
      : { is_in_laundry: false, laundry_added_at: null, last_laundry_reminder_at: null };
    await supabase.from("closet_items").update(payload).eq("id", item.id);
    handleRefresh();
    toast.success(isNowDirty ? "Moved to laundry" : "Marked as clean");
  };

  const handleMarkAllClean = async (staleItems: ClosetItem[]) => {
    const ids = staleItems.map((i) => i.id);
    await supabase
      .from("closet_items")
      .update({ is_in_laundry: false, laundry_added_at: null, last_laundry_reminder_at: null })
      .in("id", ids);
    setNeedsLaundryReview([]);
    handleRefresh();
    toast.success("All items marked as clean!");
  };

  const handleSnoozeReminders = async (staleItems: ClosetItem[]) => {
    const ids = staleItems.map((i) => i.id);
    await supabase.from("closet_items").update({ last_laundry_reminder_at: new Date().toISOString() }).in("id", ids);
    setNeedsLaundryReview([]);
    toast.info("Snoozed for 3 days");
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["closet"] });
    queryClient.invalidateQueries({ queryKey: ["closet-items"] });
    if (activeTab === "dream") queryClient.invalidateQueries({ queryKey: ["dream", user?.id] });
  };

  return (
    <div className="pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Wardrobe</h1>
        {activeTab === "closet" && (
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => setMapOpen(true)}
            >
              <CabinetIcon className="!w-6 !h-6 text-foreground" strokeWidth={1} />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="!w-6 !h-6 text-foreground stroke-[1]" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
              onClick={() => {
                setPrefill(null);
                setAddOpen(true);
              }}
            >
              <Plus className="!w-6 !h-6 text-foreground stroke-[1]" />
            </Button>
          </div>
        )}
        {activeTab === "dream" && (
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => navigate("/library")}>
            <Plus className="w-4 h-4" />
            Browse Library
          </Button>
        )}
        {activeTab === "lookbook" && <div />}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {(["closet", "lookbook", "dream"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
            }`}
          >
            {tab === "closet" ? "My Closet" : tab === "lookbook" ? "Lookbook" : "Wishlist"}
          </button>
        ))}
      </div>

      {/* My Closet Tab */}
      {activeTab === "closet" && (
        <>
          {/* Smart Laundry Reminder Banner */}
          {needsLaundryReview.length > 0 && (
            <Alert className="rounded-2xl border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {needsLaundryReview.length} item{needsLaundryReview.length > 1 ? "s" : ""} stuck in laundry
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                These have been in the wash for over a week.
              </AlertDescription>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs h-8 border-amber-300"
                  onClick={() => handleMarkAllClean(needsLaundryReview)}
                >
                  Mark as Clean
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-xs h-8 text-muted-foreground"
                  onClick={() => handleSnoozeReminders(needsLaundryReview)}
                >
                  Still Washing – Snooze 3 days
                </Button>
              </div>
            </Alert>
          )}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border border-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isClosetLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading your wardrobe...</p>
            </div>
          ) : filtered.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Your closet is empty</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Add your first item by tapping the + button above
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`bg-product-bg rounded-2xl overflow-hidden shadow-sm border border-border cursor-pointer relative ${
                    item.is_in_laundry ? "opacity-60 grayscale" : ""
                  }`}
                  onClick={() => {
                    setSelectedItem({ ...item, source: "closet" });
                    setDetailOpen(true);
                  }}
                >
                  {item.is_in_laundry && (
                    <div className="absolute top-2 left-2 z-10 bg-amber-500/90 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <WashingMachine className="w-3 h-3" /> In Laundry
                    </div>
                  )}
                  <button
                    className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      item.is_in_laundry
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/80 text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLaundry(item, !item.is_in_laundry);
                    }}
                  >
                    <WashingMachine className="w-3.5 h-3.5" />
                  </button>
                  <div className="aspect-square w-full flex items-center justify-center bg-product-bg p-2">
                    <SafeImage
                      src={imageUrls[item.id]}
                      alt={item.name || "Garment"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      fit="contain"
                      className="drop-shadow-[0px_10px_15px_rgba(0,0,0,0.1)]"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{item.name || "Unnamed"}</p>
                    {item.category && <span className="text-[10px] text-muted-foreground">{item.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lookbook Tab */}
      {activeTab === "lookbook" && <LookbookTab items={items} imageUrls={imageUrls} />}

      {/* Wishlist Tab */}
      {activeTab === "dream" && (
        <>
          {isDreamLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading wishlist...</p>
            </div>
          ) : dreamItems.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Library className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Build your Wishlist</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Browse thousands of items from our library and try them on.
              </p>
              <Button className="mt-4 rounded-xl gap-2" onClick={() => navigate("/library")}>
                <Library className="w-4 h-4" />
                Browse Library
              </Button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {dreamItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-product-bg rounded-2xl overflow-hidden shadow-sm border border-border cursor-pointer"
                  onClick={() => {
                    setSelectedItem({ ...item, source: "dream" });
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square w-full flex items-center justify-center bg-product-bg p-2">
                    <SafeImage
                      src={item.image_url}
                      alt={item.name || "Dream item"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      fit="contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[#1a1a1a] truncate">{item.name || "Unnamed"}</p>
                    <div className="flex items-center justify-between">
                      {item.brand && <span className="text-[10px] text-[#555]">{item.brand}</span>}
                      {item.price != null && (
                        <span className="text-[10px] font-semibold text-[#2c4c3b]">${item.price}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AddItemSheet
        open={addOpen}
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v && bulkQueue.length > 0) {
            const [next, ...rest] = bulkQueue;
            setPrefill(next);
            setBulkQueue(rest);
            setTimeout(() => setAddOpen(true), 300);
          }
        }}
        onItemAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["closet"] });
          queryClient.invalidateQueries({ queryKey: ["closet-items"] });
        }}
        prefill={prefill}
      />
      <GarmentDetailSheet
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={handleRefresh}
      />
      <SmartCamera
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onAnalyzed={(items: AnalyzedItem[]) => {
          if (items.length === 1) {
            setPrefill(items[0]);
            setAddOpen(true);
          } else if (items.length > 1) {
            setPrefill(items[0]);
            setBulkQueue(items.slice(1));
            setAddOpen(true);
          }
        }}
      />

      {/* Wardrobe Map Dialog */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden bg-background [&>button]:hidden">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b z-50 bg-background shrink-0">
            <h2 className="text-xl font-semibold font-outfit">AI Wardrobe Map</h2>
            <Button variant="ghost" size="icon" className="relative z-50" onClick={() => setMapOpen(false)}>
              <span className="sr-only">Close</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-muted/20">
            {closetSvg ? (
              (() => {
                const parseSvgCoordinates = (svgStr: string) => {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(svgStr, "image/svg+xml");
                  const rects = Array.from(doc.querySelectorAll("rect"));
                  return rects.map(rect => {
                    const getVal = (attr: string) => (parseFloat(rect.getAttribute(attr) || "0") / 10);
                    return {
                      id: rect.getAttribute("id") || "",
                      left: `${getVal("x")}%`,
                      top: `${getVal("y")}%`,
                      width: `${getVal("width")}%`,
                      height: `${getVal("height")}%`,
                    };
                  });
                };

                const zones = parseSvgCoordinates(closetSvg);

                const getZoneContent = (id: string) => {
                  switch (id) {
                    case "left_shelves": return { icon: <Grid className="w-5 h-5 mb-1" />, text: "Left Shelving" };
                    case "center_hanging_shirts": return { icon: <Shirt className="w-5 h-5 mb-1" />, text: "Center Hanging Shirts" };
                    case "center_drawers": return { icon: <Server className="w-5 h-5 mb-1" />, text: "Center Drawers" };
                    case "right_hanging_dresses": return { icon: <User className="w-5 h-5 mb-1" />, text: "Right Hanging Dresses" };
                    case "floor_storage": return { icon: <ShoppingBag className="w-5 h-5 mb-1" />, text: "Floor Bags/Storage" };
                    default: return null;
                  }
                };

                return (
                  <div className="relative w-full aspect-square max-h-[60vh] mx-auto bg-background border border-border rounded-xl overflow-hidden">
                    {/* Layer 1: The AI Blueprint Background */}
                    <div
                      className="absolute inset-0 w-full h-full [&>svg]:w-full [&>svg]:h-full [&_rect]:!fill-transparent [&_rect]:!stroke-foreground/20 [&_rect]:!stroke-[2px]"
                      dangerouslySetInnerHTML={{ __html: closetSvg }}
                    />

                    {/* Layer 2: The React Interactive Overlay */}
                    {zones.map((zone, idx) => {
                      const content = getZoneContent(zone.id);
                      if (!content) return null;
                      return (
                        <div
                          key={idx}
                          className="absolute flex flex-col items-center justify-center text-foreground p-2 text-center"
                          style={{ left: zone.left, top: zone.top, width: zone.width, height: zone.height }}
                        >
                          {content.icon}
                          <span className="text-[10px] sm:text-xs font-medium leading-tight">{content.text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-6">
                <CabinetIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Take a photo of your closet and AI will create an interactive map of its compartments.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-between items-center bg-background z-50 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleClosetPhotoSelect}
            />
            <Button
              onClick={() => openClosetPhotoPicker(Boolean(closetSvg))}
              disabled={generatingMap}
              variant="outline"
              className="rounded-xl gap-2"
            >
              {generatingMap ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : closetSvg ? (
                "Retake Photo"
              ) : (
                "Take Closet Photo"
              )}
            </Button>
            <Button className="rounded-xl gap-2" disabled={!closetSvg}>
              Save Closet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WardrobePage;
