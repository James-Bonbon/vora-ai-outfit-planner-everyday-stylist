import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, Loader2, Trash2, Paperclip, X, Image as ImageIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import SafeImage from "@/components/ui/SafeImage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfileData } from "@/hooks/useMirrorData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getCachedSignedUrls } from "@/utils/signedUrlCache";

export type ChatQuickAction = {
  id: string;
  label: string;
  emoji?: string;
  kind: "send_message" | "see_on_me" | "save_to_lookbook" | "open_wardrobe" | "open_stylist";
  message?: string;
  garment_ids?: string[];
  outfit_name?: string;
};

const ALLOWED_KINDS = new Set([
  "send_message",
  "see_on_me",
  "save_to_lookbook",
  "open_wardrobe",
  "open_stylist",
]);

interface ShoppingProduct {
  title: string;
  source?: string;
  price?: string;
  link: string;
  imageUrl?: string;
  reason?: string;
}

export interface ProductResult {
  title: string;
  brand?: string | null;
  price?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
  productUrl: string;
  retailer?: string | null;
  reason?: string | null;
  category?: string | null;
  colors?: string[];
  available?: boolean | null;
}

export interface ProductSearchMeta {
  source?: string;
  query?: string;
  resultCount?: number;
  status?: "success" | "empty" | "error" | "not_configured" | string;
}

interface ProductReference {
  source?: string;
  confidence?: number;
  url?: string;
  title?: string;
  brand?: string;
  color?: string;
  category?: string;
  imageUrl?: string;
  evidence?: string[];
  missingFields?: string[];
  needsClarification?: boolean;
  [key: string]: unknown;
}

interface DebugInfo {
  referenceIntent?: string;
  source?: string;
  confidence?: number;
  detected?: { category?: string; color?: string; secondaryColors?: string[]; title?: string } | null;
  evidence?: string[];
  missingFields?: string[];
  shoppingAvailable?: boolean;
  recommendation?: { acceptedIds?: string[]; rejected?: Array<{ id: string; reason: string }> };
  pipeline?: unknown;
  wishlistInserted?: boolean;
  // General chat
  chatIntent?: string;
  activeOutfit?: { garmentIds?: string[]; garmentNames?: string[]; categories?: string[]; occasion?: string | null; weather?: string | null; reason?: string | null } | null;
  activeOutfitIds?: string[];
  usedWardrobe?: boolean;
  usedWeather?: boolean;
  usedProfile?: boolean;
  onlineSearchAttempted?: boolean;
  recommendedIds?: string[];
  shoppingResultsCount?: number;
  quickActionReason?: string;
  mode?: string;
  [key: string]: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggested_garment_ids?: string[] | null;
  quick_actions?: ChatQuickAction[] | null;
  attachment_url?: string | null;
  shopping?: ShoppingProduct[] | null;
  products?: ProductResult[] | null;
  product_search?: ProductSearchMeta | null;
  product_reference?: ProductReference | null;
  debug_info?: DebugInfo | null;
  created_at: string;
}

const IS_DEV_PREVIEW = (() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("id-preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev")
  );
})();

interface GarmentMini {
  id: string;
  name: string | null;
  category: string | null;
  color: string | null;
  image_url: string;
  thumbnail_url?: string | null;
}

interface Attachment {
  url?: string;
  base64?: string;
  file?: File;
}

interface StylistChatProps {
  initialMessage?: string;
}

const DebugChip: React.FC<{ debug: DebugInfo; productRef?: ProductReference }> = ({ debug, productRef }) => {
  const [open, setOpen] = useState(false);
  const conf = typeof debug.confidence === "number" ? debug.confidence.toFixed(2) : "—";
  const rejected = debug.recommendation?.rejected || [];
  const accepted = debug.recommendation?.acceptedIds || [];
  const isRefMode = !!productRef && (productRef.confidence ?? 0) > 0;
  const headerLabel = isRefMode
    ? `${debug.referenceIntent || "—"} · ${debug.source || "—"} · conf ${conf}`
    : `${debug.chatIntent || "general_opinion"} · ${(debug.recommendedIds || []).length} recs${typeof debug.shoppingResultsCount === "number" ? ` · shop ${debug.shoppingResultsCount}` : ""}`;
  const yn = (v?: boolean) => (v ? "yes" : "no");
  return (
    <div className="mt-1 text-[10px] font-mono">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        <span>debug</span>
        <span className="opacity-70">· {headerLabel}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 p-2 rounded-md border border-border bg-muted/30 text-muted-foreground space-y-1 leading-relaxed">
          <div><b>chatIntent:</b> {debug.chatIntent || "—"} · <b>quickActionReason:</b> {debug.quickActionReason || "—"}</div>
          <div>
            <b>used:</b> wardrobe={yn(debug.usedWardrobe)} · weather={yn(debug.usedWeather)} · profile={yn(debug.usedProfile)}
          </div>
          <div>
            <b>onlineSearchAttempted:</b> {yn(debug.onlineSearchAttempted)} · <b>shoppingResultsCount:</b> {debug.shoppingResultsCount ?? 0} · <b>shoppingAvailable:</b> {yn(debug.shoppingAvailable)}
          </div>
          <div>
            <b>recommendedIds:</b> {(debug.recommendedIds || accepted).length}
          </div>
          <div>
            <b>activeOutfitIds:</b> {(debug.activeOutfitIds || debug.activeOutfit?.garmentIds || []).length}
            {debug.activeOutfit?.garmentNames && debug.activeOutfit.garmentNames.length > 0 && (
              <span className="opacity-70"> · {debug.activeOutfit.garmentNames.slice(0, 4).join(", ")}</span>
            )}
          </div>
          {isRefMode && (
            <>
              <div className="pt-1 border-t border-border/50"><b>refIntent:</b> {debug.referenceIntent || "—"} · <b>source:</b> {debug.source || "—"} · <b>confidence:</b> {conf}</div>
              <div>
                <b>detected:</b>{" "}
                {debug.detected
                  ? `${debug.detected.category || "—"} / ${debug.detected.color || "—"}${debug.detected.title ? ` · ${debug.detected.title}` : ""}`
                  : "—"}
              </div>
              <div><b>evidence:</b> {(debug.evidence || []).join(", ") || "—"}</div>
              <div><b>missingFields:</b> {(debug.missingFields || []).join(", ") || "—"}</div>
              <div><b>needsClarification:</b> {String(productRef?.needsClarification ?? false)}</div>
            </>
          )}
          {rejected.length > 0 && (
            <div>
              <b>rejected:</b>
              <ul className="list-disc list-inside opacity-80">
                {rejected.slice(0, 8).map((r, i) => (
                  <li key={i}>{r.id}: {r.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {debug.pipeline != null && (
            <details className="mt-1">
              <summary className="cursor-pointer">pipeline</summary>
              <pre className="text-[9px] whitespace-pre-wrap break-all opacity-80">{JSON.stringify(debug.pipeline, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const isValidHttpUrl = (u?: string | null): u is string => {
  if (!u) return false;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
};

const formatPrice = (price?: string | null, currency?: string | null): string | null => {
  if (!price) return null;
  const trimmed = String(price).trim();
  if (!trimmed) return null;
  if (/[^\d.,\s]/.test(trimmed)) return trimmed;
  if (!currency) return trimmed;
  const symbolMap: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };
  const sym = symbolMap[currency.toUpperCase()];
  return sym ? `${sym}${trimmed}` : `${trimmed} ${currency}`;
};

interface ProductResultCardsProps {
  products: ProductResult[];
  source?: string | null;
  onSendMessage: (text: string) => void;
}

const ProductResultCards: React.FC<ProductResultCardsProps> = ({ products, source, onSendMessage }) => {
  const visible = products.slice(0, 6).filter((p) => isValidHttpUrl(p.productUrl));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {visible.map((p, i) => {
          const priceText = formatPrice(p.price, p.currency);
          const meta = [p.brand, p.retailer].filter(Boolean).join(" · ");
          return (
            <div
              key={`${p.productUrl}-${i}`}
              className="rounded-xl border border-border bg-card overflow-hidden flex"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-secondary">
                {p.imageUrl ? (
                  <SafeImage
                    src={p.imageUrl}
                    alt={p.title}
                    aspectRatio="aspect-square"
                    fit="cover"
                    wrapperClassName="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 p-2.5 flex flex-col gap-1">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {p.title}
                </p>
                {(meta || priceText) && (
                  <div className="flex items-center justify-between gap-2">
                    {meta && (
                      <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">
                        {meta}
                      </p>
                    )}
                    {priceText && (
                      <p className="text-xs font-semibold text-foreground shrink-0">{priceText}</p>
                    )}
                  </div>
                )}
                {p.reason && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{p.reason}</p>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  <a
                    href={p.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`Style this product: ${p.title}`)}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                  >
                    Style this
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`Find similar options to: ${p.title}`)}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                  >
                    Find similar
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`Compare this option with the others: ${p.title}`)}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                  >
                    Compare
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {source && (
        <p className="text-[10px] text-muted-foreground px-1">Results from {source}</p>
      )}
    </div>
  );
};

export const StylistChat: React.FC<StylistChatProps> = ({ initialMessage }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfileData();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [savingActionId, setSavingActionId] = useState<string | null>(null);
  const [pendingUserText, setPendingUserText] = useState<string>("");
  const [pendingHasAttachment, setPendingHasAttachment] = useState<boolean>(false);
  const [pendingStage, setPendingStage] = useState<0 | 1 | 2>(0);
  const [lastFailed, setLastFailed] = useState<{ userMessage: string; attachmentSnapshot: Attachment | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialSentRef = useRef(false);

  // Fetch chat history
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as ChatMessage[];
    },
    enabled: !!user,
  });

  // Fetch all closet items for rendering garment cards
  const { data: garments = [] } = useQuery<GarmentMini[]>({
    queryKey: ["chat-garments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closet_items")
        .select("id, name, category, color, image_url, thumbnail_url");
      if (error) throw error;
      return (data || []) as GarmentMini[];
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });

  // Generate signed URLs for garment thumbnails (fall back to full image for legacy rows)
  const garmentIds = garments.map((g) => g.id);
  const { data: garmentUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ["chat-garment-urls", garmentIds],
    queryFn: async () => {
      if (garments.length === 0) return {};
      const paths = garments.map((g) => g.thumbnail_url || g.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", paths);
      const out: Record<string, string> = {};
      for (const g of garments) {
        const path = g.thumbnail_url || g.image_url;
        if (path && urlMap[path]) out[g.id] = urlMap[path];
      }
      return out;
    },
    enabled: garments.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });

  // Sign chat attachment paths from the 'selfies' bucket so they render in history
  const attachmentPaths = messages
    .map((m) => m.attachment_url)
    .filter((p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"));
  const { data: attachmentUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ["chat-attachment-urls", attachmentPaths],
    queryFn: async () => {
      if (attachmentPaths.length === 0) return {};
      return await getCachedSignedUrls("selfies", attachmentPaths);
    },
    enabled: attachmentPaths.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
  const resolveAttachment = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    if (raw.startsWith("data:") || raw.startsWith("http")) return raw;
    return attachmentUrls[raw];
  };

  // Send message mutation (with optimistic update + reliable 30s timeout)
  const sendMutation = useMutation({
    mutationFn: async (
      args: { userMessage: string; attachmentSnapshot: Attachment | null }
    ) => {
      const { userMessage, attachmentSnapshot } = args;

      // Build conversation context (last 20 messages). The Edge Function persists
      // the latest user message ONLY after validation + rate-limit checks pass,
      // so we no longer insert it here.
      const recentMessages = messages.slice(-20).map((m) => {
        const hadAttachment = m.role === "user" && !!m.attachment_url;
        const text = m.content || "";
        const content = hadAttachment
          ? `${text ? text + "\n" : ""}[image attached]`
          : text;
        return { role: m.role, content };
      });
      recentMessages.push({ role: "user", content: userMessage });

      // Reliable client-side 30s timeout via Promise.race (does not rely on
      // untyped `signal` forwarding by supabase-js).
      const TIMEOUT_MS = 30_000;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error("The stylist took too long to respond. Please try again.")
            ),
          TIMEOUT_MS
        );
      });

      const invokePromise = supabase.functions.invoke("chat-stylist", {
        body: {
          messages: recentMessages,
          attachment: attachmentSnapshot
            ? { base64: attachmentSnapshot.base64, url: attachmentSnapshot.url }
            : undefined,
        },
      });

      let result: Awaited<typeof invokePromise>;
      try {
        result = await Promise.race([invokePromise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const { data, error } = result;

      if (error) {
        // FunctionsHttpError exposes a Response on `context`. Parse safely
        // OUTSIDE a throw so the structured backend error reaches onError.
        let parsedMessage: string | null = null;
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const parsed = await ctx.json();
            if (parsed && typeof parsed.error === "string") {
              parsedMessage = parsed.error;
            }
          } catch {
            /* parsing failed — fall back to original error below */
          }
        }
        if (parsedMessage) throw new Error(parsedMessage);
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as { reply_text: string; recommended_ids: string[] };
    },
    onMutate: async ({ userMessage, attachmentSnapshot }) => {
      await queryClient.cancelQueries({ queryKey: ["chat-messages"] });
      const previous = queryClient.getQueryData<ChatMessage[]>(["chat-messages"]) || [];
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: userMessage,
        suggested_garment_ids: null,
        attachment_url: attachmentSnapshot?.base64 || null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(["chat-messages"], [...previous, optimistic]);
      setPendingUserText(userMessage);
      setPendingHasAttachment(!!attachmentSnapshot);
      setPendingStage(0);
      setLastFailed(null);
      return { previous };
    },
    onSuccess: () => {
      // Refetch from server (source of truth) — replaces optimistic + adds assistant reply.
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      setPendingUserText("");
      setPendingHasAttachment(false);
      setPendingStage(0);
    },
    onError: (err: Error, vars, context) => {
      // Roll back optimistic update so the UI doesn't show an unsent message.
      if (context?.previous) {
        queryClient.setQueryData(["chat-messages"], context.previous);
      }
      const msg = err?.message || "";
      // Surface useful, on-brand feedback for known error shapes.
      if (msg.toLowerCase().includes("too long to respond")) {
        toast.error(msg);
      } else if (
        msg.toLowerCase().includes("rate limit") ||
        msg.toLowerCase().includes("too quickly") ||
        msg.toLowerCase().includes("daily chat limit")
      ) {
        toast.error("Slow down a moment", { description: msg });
      } else if (msg.toLowerCase().includes("credits")) {
        toast.error("Stylist temporarily unavailable", { description: msg });
      } else if (
        msg.toLowerCase().includes("too long") ||
        msg.toLowerCase().includes("must be a string") ||
        msg.toLowerCase().includes("attachment") ||
        msg.toLowerCase().includes("max ")
      ) {
        toast.error("Couldn't send that", { description: msg });
      } else {
        toast.error("Stylist unavailable", {
          description: msg || "Please try again in a moment.",
        });
      }
      // Stash for inline retry chip.
      setLastFailed({ userMessage: vars.userMessage, attachmentSnapshot: vars.attachmentSnapshot });
      setPendingUserText("");
      setPendingHasAttachment(false);
      setPendingStage(0);
      // Refetch to reconcile with server (the user message was already persisted).
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });

  // Stage progression for the assistant status bubble.
  useEffect(() => {
    if (!sendMutation.isPending) return;
    setPendingStage(0);
    const t1 = setTimeout(() => setPendingStage(1), 6000);
    const t2 = setTimeout(() => setPendingStage(2), 14000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sendMutation.isPending]);

  // Pick a safe, non-misleading status label based on the user's last message.
  // We only use phrasing that matches what the backend actually does.
  const statusLabel = (() => {
    if (pendingStage === 2) return "Almost there…";
    if (pendingStage === 1) return "Still working on it…";
    if (pendingHasAttachment) return "Looking at your photo…";
    const t = (pendingUserText || "").toLowerCase();
    // Phase 1: never claim live browsing/searching unless a real tool actually runs.
    // The frontend can't know server-side tool availability, so use safe wording.
    if (/\b(compare|which (one |is )?(better|best)|or sneakers|or loafers)\b/.test(t))
      return "Weighing the options…";
    if (/\b(missing|gap|wardrobe (review|gaps?))\b/.test(t))
      return "Reviewing your wardrobe…";
    if (/\b(shop|buy|browse|find me|search for|online|cheaper|alternative|under £|under \$)\b/.test(t))
      return "Searching products…";
    if (/(shoe|sneaker|trainer|loafer|boot|heel|sandal|mule|flat|footwear|pump)/.test(t))
      return "Checking shop options…";
    if (/(wardrobe|closet|outfit|style|wear|dress|look)/.test(t))
      return "Checking your style context…";
    return "Thinking…";
  })();


  // Clear chat
  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      toast.success("Chat cleared");
    },
    onError: (err: Error) => {
      toast.error("Couldn't clear chat", {
        description: err?.message || "Please try again.",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({ base64: ev.target?.result as string, file });
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const canSend = (input.trim().length > 0 || attachment != null) && !sendMutation.isPending;
  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    const attachmentSnapshot = attachment;
    setInput("");
    setAttachment(null);
    sendMutation.mutate({ userMessage: text || (attachmentSnapshot ? "What do you think of this?" : ""), attachmentSnapshot });
  };

  const sendQuickMessage = (message: string) => {
    if (!message.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ userMessage: message.trim(), attachmentSnapshot: null });
  };

  const handleQuickAction = async (action: ChatQuickAction) => {
    if (!ALLOWED_KINDS.has(action.kind)) return;
    if (sendMutation.isPending) return;

    // Filter garment IDs against the loaded wardrobe
    const validGarmentIds = (action.garment_ids || []).filter((id) =>
      garments.some((g) => g.id === id)
    );

    switch (action.kind) {
      case "send_message": {
        if (action.message) sendQuickMessage(action.message);
        return;
      }
      case "see_on_me": {
        if (validGarmentIds.length === 0) return;
        navigate("/mirror", { state: { preSelectedIds: validGarmentIds } });
        return;
      }
      case "open_wardrobe":
        navigate("/wardrobe");
        return;
      case "open_stylist":
        navigate("/mirror");
        return;
      case "save_to_lookbook": {
        if (validGarmentIds.length === 0 || !user) return;
        if (savingActionId === action.id) return;
        setSavingActionId(action.id);
        try {
          const { error } = await supabase.from("lookbook_outfits").insert({
            user_id: user.id,
            name: action.outfit_name || "Vora Stylist Look",
            garment_ids: validGarmentIds,
          });
          if (error) throw error;
          toast.success("Saved to Lookbook.");
          queryClient.invalidateQueries({ queryKey: ["lookbook"] });
          queryClient.invalidateQueries({ queryKey: ["lookbook_outfits"] });
        } catch (err) {
          toast.error("Couldn't save look", {
            description: err instanceof Error ? err.message : "Please try again.",
          });
        } finally {
          setSavingActionId(null);
        }
        return;
      }
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending]);

  // Auto-send initial message from shared garment
  useEffect(() => {
    if (initialMessage && !initialSentRef.current && user && !sendMutation.isPending) {
      initialSentRef.current = true;
      sendMutation.mutate({ userMessage: initialMessage, attachmentSnapshot: null });
    }
  }, [initialMessage, user]);

  const getGarment = (id: string) => garments.find((g) => g.id === id);

  return (
    <div className="flex flex-col h-full min-h-0 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 pr-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-flatlay-cta/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-flatlay-cta" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground font-outfit">Vora Stylist</h2>
            <p className="text-[10px] text-muted-foreground">Your personal AI stylist</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 pb-2">
        {messages.length === 0 && !sendMutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-3xl bg-flatlay-cta/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-flatlay-cta" />
            </div>
            <h3 className="text-base font-semibold text-foreground font-outfit">
              Hey! I'm your stylist 👋
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
              Ask me for outfit ideas, styling advice, or what to wear for any occasion. I know your whole wardrobe!
            </p>
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {[
                "What should I wear today?",
                "Style this for work",
                "Make me an outfit from my closet",
                "What's missing from my wardrobe?",
                "Help me look more polished",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendQuickMessage(prompt)}
                  disabled={sendMutation.isPending}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-flatlay-cta/40 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className="max-w-[85%] space-y-2">
                {msg.role === "user" && msg.attachment_url && resolveAttachment(msg.attachment_url) && (
                  <div className="flex justify-end">
                    <img
                      src={resolveAttachment(msg.attachment_url)}
                      alt="Attached"
                      className="max-w-[220px] max-h-[260px] rounded-2xl rounded-br-md border border-border object-cover"
                    />
                  </div>
                )}
                {msg.content && msg.content.trim().length > 0 && (
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border text-foreground rounded-bl-md"
                    )}
                  >
                    {msg.content}
                  </div>
                )}

                {/* Shopping results (cheaper alternatives) */}
                {msg.role === "assistant" && Array.isArray(msg.shopping) && msg.shopping.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {msg.shopping.map((p, i) => (
                      <a
                        key={i}
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-border overflow-hidden bg-card hover:border-primary/40 transition-colors"
                      >
                        {p.imageUrl && (
                          <div className="aspect-square w-full bg-secondary flex items-center justify-center overflow-hidden">
                            <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <div className="p-2 space-y-0.5">
                          <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">{p.title}</p>
                          <div className="flex items-center justify-between gap-1">
                            {p.price && <p className="text-xs font-semibold text-foreground">{p.price}</p>}
                            {p.source && <p className="text-[10px] text-muted-foreground truncate">{p.source}</p>}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Garment cards */}
                {msg.role === "assistant" &&
                  msg.suggested_garment_ids &&
                  msg.suggested_garment_ids.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {msg.suggested_garment_ids.map((gId) => {
                        const garment = getGarment(gId);
                        if (!garment) return null;
                        const url = garmentUrls[gId];
                        return (
                          <div
                            key={gId}
                            className="rounded-xl border border-[#e5e7df] overflow-hidden bg-[#f5f2e9]"
                          >
                            {url && (
                              <div className="relative aspect-[4/5] w-full p-1.5 flex items-center justify-center">
                                <img
                                  src={url}
                                  alt={garment.name || "Garment"}
                                  className="max-h-full max-w-full drop-shadow-md"
                                />
                              </div>
                            )}
                            <div className="p-3 space-y-1">
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">
                                {garment.name || "Unnamed"}
                              </p>
                              <p className="text-xs text-[#555] uppercase tracking-wider">
                                {[garment.category, garment.color]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* Quick action bubbles */}
                {msg.role === "assistant" &&
                  Array.isArray(msg.quick_actions) &&
                  msg.quick_actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.quick_actions
                        .filter((a) => a && ALLOWED_KINDS.has(a.kind))
                        .map((action) => {
                          // Hide actions that need garments but have none valid
                          if (
                            (action.kind === "see_on_me" || action.kind === "save_to_lookbook") &&
                            !(action.garment_ids || []).some((id) =>
                              garments.some((g) => g.id === id)
                            )
                          ) {
                            return null;
                          }
                          const isSaving =
                            action.kind === "save_to_lookbook" && savingActionId === action.id;
                          return (
                            <button
                              key={action.id}
                              onClick={() => handleQuickAction(action)}
                              disabled={sendMutation.isPending || isSaving}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : action.emoji ? (
                                <span>{action.emoji}</span>
                              ) : null}
                              <span>{action.label}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}

                {/* Dev-only debug chip */}
                {IS_DEV_PREVIEW && msg.role === "assistant" && msg.debug_info && (
                  <DebugChip debug={msg.debug_info} productRef={msg.product_reference || undefined} />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Assistant working status */}
        {sendMutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-border flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{statusLabel}</span>
            </div>
          </motion.div>
        )}

        {/* Inline error + retry */}
        {!sendMutation.isPending && lastFailed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] space-y-2">
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-destructive/30 text-sm text-foreground">
                Couldn't reach the stylist. Want to try again?
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => {
                    const retry = lastFailed;
                    setLastFailed(null);
                    sendMutation.mutate(retry);
                  }}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                >
                  Try again
                </button>
                <button
                  onClick={() => setLastFailed(null)}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 px-2 pt-2">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border bg-secondary">
            {attachment.base64 ? (
              <img src={attachment.base64} alt="Attachment" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => setAttachment(null)}
              className="absolute top-0.5 right-0.5 z-10 w-[22px] h-[22px] rounded-full bg-foreground/85 text-background shadow-md flex items-center justify-center hover:bg-foreground transition-colors"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {attachment.file?.name || "Image attached"}
          </span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Input */}
      <div className="flex items-end gap-2 pt-3 border-t border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendMutation.isPending}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-grow: reset then size to scrollHeight, capped to ~5 lines (~120px)
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          rows={1}
          placeholder="Ask for outfit ideas..."
          className="min-h-10 h-10 max-h-[120px] resize-none rounded-2xl bg-secondary border-transparent focus-visible:ring-primary py-2.5 leading-tight overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sendMutation.isPending}
        />
        <Button
          size="icon"
          className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-10 w-10"
          onClick={handleSend}
          disabled={!canSend}
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
