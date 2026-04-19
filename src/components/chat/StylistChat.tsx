import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Trash2, Paperclip, X, Image as ImageIcon } from "lucide-react";
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggested_garment_ids?: string[] | null;
  created_at: string;
}

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

export const StylistChat: React.FC<StylistChatProps> = ({ initialMessage }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfileData();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
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
      return (data || []) as ChatMessage[];
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

  // Send message mutation (with optimistic update + reliable 30s timeout)
  const sendMutation = useMutation({
    mutationFn: async (
      args: { userMessage: string; attachmentSnapshot: Attachment | null }
    ) => {
      const { userMessage, attachmentSnapshot } = args;

      // Build conversation context (last 20 messages). The Edge Function persists
      // the latest user message ONLY after validation + rate-limit checks pass,
      // so we no longer insert it here.
      const recentMessages = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));
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
    onMutate: async ({ userMessage }) => {
      // Optimistically append the user message so the UI feels instant.
      await queryClient.cancelQueries({ queryKey: ["chat-messages"] });
      const previous = queryClient.getQueryData<ChatMessage[]>(["chat-messages"]) || [];
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: userMessage,
        suggested_garment_ids: null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(
        ["chat-messages"],
        [...previous, optimistic]
      );
      return { previous };
    },
    onSuccess: () => {
      // Refetch from server (source of truth) — replaces optimistic + adds assistant reply.
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (err: Error, _vars, context) => {
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
      // Refetch to reconcile with server (the user message was already persisted).
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });

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

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    const attachmentSnapshot = attachment;
    setInput("");
    setAttachment(null);
    sendMutation.mutate({ userMessage: text, attachmentSnapshot });
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
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
              {["What should I wear today?", "Date night outfit", "Work outfit ideas"].map(
                (prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-flatlay-cta/40 transition-colors"
                  >
                    {prompt}
                  </button>
                )
              )}
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
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-bl-md"
                  )}
                >
                  {msg.content}
                </div>

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
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {sendMutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-card border border-border">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 px-2 pt-2">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border bg-secondary">
            {attachment.base64 ? (
              <img src={attachment.base64} alt="Attachment" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => setAttachment(null)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="w-3 h-3" />
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
          disabled={!input.trim() || sendMutation.isPending}
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
