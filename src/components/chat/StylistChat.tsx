import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import SafeImage from "@/components/ui/SafeImage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
}

export const StylistChat: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    queryKey: ["chat-garments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closet_items")
        .select("id, name, category, color, image_url");
      if (error) throw error;
      return (data || []) as GarmentMini[];
    },
    enabled: !!user,
  });

  // Generate signed URLs for garment images
  const garmentIds = garments.map((g) => g.id);
  const { data: garmentUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ["chat-garment-urls", garmentIds],
    queryFn: async () => {
      if (garments.length === 0) return {};
      const paths = garments.map((g) => g.image_url);
      const { data } = await supabase.storage
        .from("garments")
        .createSignedUrls(paths, 3600);
      if (!data) return {};
      const urlMap: Record<string, string> = {};
      data.forEach((item, i) => {
        if (item.signedUrl) urlMap[garments[i].id] = item.signedUrl;
      });
      return urlMap;
    },
    enabled: garments.length > 0,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      // Persist user message
      await supabase.from("chat_messages").insert({
        user_id: user!.id,
        role: "user",
        content: userMessage,
      });

      // Build conversation context (last 20 messages)
      const recentMessages = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      recentMessages.push({ role: "user", content: userMessage });

      const { data, error } = await supabase.functions.invoke("chat-stylist", {
        body: { messages: recentMessages },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { reply_text: string; recommended_ids: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (err: Error) => {
      toast.error("Stylist unavailable", { description: err.message });
      // Still refresh to show the user message
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
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(text);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending]);

  const getGarment = (id: string) => garments.find((g) => g.id === id);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
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
                      ? "bg-flatlay-cta text-white rounded-br-md"
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
                            className="rounded-xl overflow-hidden border border-border bg-card"
                          >
                            {url && (
                              <SafeImage
                                src={url}
                                alt={garment.name || "Garment"}
                                aspectRatio="aspect-square"
                                wrapperClassName="w-full"
                                className="object-cover"
                              />
                            )}
                            <div className="p-2">
                              <p className="text-xs font-medium text-foreground truncate">
                                {garment.name || "Unnamed"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
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

      {/* Input */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for outfit ideas..."
          className="rounded-full bg-secondary border-transparent focus-visible:ring-flatlay-cta"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={sendMutation.isPending}
        />
        <Button
          size="icon"
          className="rounded-full bg-flatlay-cta hover:bg-flatlay-cta/90 text-white shrink-0 h-10 w-10"
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
