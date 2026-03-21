import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── URL metadata helper ─────────────────────────────────────── */
async function fetchUrlMetadata(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { "User-Agent": "VoraBot/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    const desc =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() ||
      "";
    const ogImage =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim() || "";
    return `[Link Preview]\nURL: ${url}\nTitle: ${title}\nDescription: ${desc}\nImage: ${ogImage}`;
  } catch {
    return `[Link Preview]\nURL: ${url}\n(Could not fetch metadata)`;
  }
}

/* ── Extract URLs from text ──────────────────────────────────── */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>\])+]+/g;
  return [...(text.match(urlRegex) || [])];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { messages, userContext, attachment } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch wardrobe ──────────────────────────────────────
    const { data: wardrobe } = await supabase
      .from("closet_items")
      .select("id, name, category, color, material, brand")
      .eq("user_id", userId);

    // ── Fetch profile ───────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_shape, sex, height_cm, weight_kg, display_name")
      .eq("user_id", userId)
      .single();

    const wardrobeJson = JSON.stringify(wardrobe || []);

    // ── VORA Senior Stylist system prompt ────────────────────
    const systemPrompt = `You are the VORA Senior Stylist — an elite, editorial fashion consultant embodying "Quiet Luxury" and "Organic Minimalism."

PERSONALITY & TONE:
- Speak like a trusted personal stylist at a high-end atelier: warm yet authoritative, insightful yet concise.
- Use elegant, measured language. Avoid exclamation marks, emojis, and generic enthusiasm.
- Frame advice through the lens of timeless style: fabric quality, color harmony, silhouette balance, and intentional dressing.
- When complimenting, be specific ("The drape of that crepe jersey pairs beautifully with structured tailoring") rather than generic ("That looks great!").

USER PROFILE:
- Name: ${profile?.display_name || "there"}
- Body shape: ${profile?.body_shape || "not specified"}
- Sex: ${profile?.sex || "not specified"}
- Height: ${profile?.height_cm ? profile.height_cm + " cm" : "not specified"}
- Weight: ${profile?.weight_kg ? profile.weight_kg + " kg" : "not specified"}

USER'S WARDROBE (JSON — these are the only items you may recommend):
${wardrobeJson}

RULES:
1. When recommending outfits, ONLY suggest garments from the wardrobe above using their exact IDs. Never invent items.
2. You MUST use the suggest_outfit tool when recommending specific garments — even a single item.
3. Explain WHY items work together: color theory, fabric interplay, silhouette balance, occasion-appropriateness.
4. If the wardrobe lacks suitable items, say so honestly and describe what archetype or piece would complete the look.
5. When the user shares an image, analyze it thoughtfully: identify colors, textures, silhouettes, and styling opportunities. Relate observations back to their wardrobe.
6. When given a link preview, incorporate that context naturally into your advice.
7. Keep responses focused and editorial — never rambling. Aim for the cadence of a personal styling note, not a blog post.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ── Build messages with multimodal support ──────────────
    // Process the last user message to handle images and URLs
    const processedMessages = [...messages];
    const lastMsg = processedMessages[processedMessages.length - 1];

    // Handle image attachment — convert to multimodal content parts
    if (attachment?.base64 && lastMsg?.role === "user") {
      const textContent = lastMsg.content || "";
      lastMsg.content = [
        { type: "text", text: textContent || "What do you think of this?" },
        {
          type: "image_url",
          image_url: { url: attachment.base64 },
        },
      ];
    }

    // Handle URLs in the last user message — fetch metadata and append
    if (lastMsg?.role === "user") {
      const textContent = typeof lastMsg.content === "string" ? lastMsg.content : "";
      const urls = extractUrls(textContent);
      if (urls.length > 0) {
        const metadataResults = await Promise.all(urls.slice(0, 2).map(fetchUrlMetadata));
        const linkContext = metadataResults.join("\n\n");
        if (typeof lastMsg.content === "string") {
          lastMsg.content = `${lastMsg.content}\n\n${linkContext}`;
        } else if (Array.isArray(lastMsg.content)) {
          lastMsg.content.push({ type: "text", text: linkContext });
        }
      }
    }

    // ── Call LLM ────────────────────────────────────────────
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...processedMessages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_outfit",
              description:
                "Recommend specific garments from the user's wardrobe. Use this whenever you mention specific clothing items.",
              parameters: {
                type: "object",
                properties: {
                  reply_text: {
                    type: "string",
                    description: "Your conversational styling advice explaining why these items work.",
                  },
                  recommended_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of garment UUIDs from the user's wardrobe.",
                  },
                },
                required: ["reply_text", "recommended_ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const choice = aiResult.choices?.[0];

    let replyText = "";
    let recommendedIds: string[] = [];

    if (choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      replyText = args.reply_text || "";
      recommendedIds = args.recommended_ids || [];
    } else {
      replyText = choice?.message?.content || "I'm not sure how to help with that. Try asking me about outfit ideas.";
    }

    // Persist assistant message
    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "assistant",
      content: replyText,
      suggested_garment_ids: recommendedIds.length > 0 ? recommendedIds : null,
    });

    return new Response(
      JSON.stringify({
        reply_text: replyText,
        recommended_ids: recommendedIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat-stylist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
