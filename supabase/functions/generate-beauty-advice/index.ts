import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) throw new Error("SERPER_API_KEY is not configured");

    const body = await req.json();
    // Support both legacy single-query and new chat-history format
    const messages: Array<{ role: string; content: string }> = body.messages || [];
    if (body.query && messages.length === 0) {
      messages.push({ role: "user", content: body.query });
    }
    if (messages.length === 0) throw new Error("Missing 'messages' or 'query' field");

    const products = body.products;

    const systemPrompt = `You are an Elite Clinical Esthetician and Cosmetic Chemist. You must explain the precise MECHANISM OF ACTION for every chemical/ingredient you recommend using professional, clinical terminology (e.g., lipophilic, keratinolytic, trans-epidermal water loss, tyrosinase inhibition). Provide deep, scientific context so the user understands exactly how the molecule interacts with their skin biology. End your response with an engaging question to investigate their routine further. NEVER diagnose medical conditions. If a user presents a severe medical issue, politely advise them to see a doctor, but STILL offer a gentle, soothing over-the-counter brand suggestion. Recommend SINGLE products only, never kits or systems.

The user has these products on their shelf: ${JSON.stringify(products || [])}

Based on their question, provide expert skincare advice and suggest specific brand-name products they should search for.`;

    // Build messages payload: system + full chat history
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "beauty_advice",
              description: "Return beauty advice with search terms and quick reply suggestions",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Conversational advice text for the user. You MAY recommend specific brand names. Use clinical terminology to explain mechanism of action.",
                  },
                  search_terms: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of SHORT, targeted e-commerce search queries (MAX 3 words). You MUST use brand names here if you recommend them (e.g., 'Cerave SA Cleanser'). NEVER use long phrases.",
                  },
                  quick_replies: {
                    type: "array",
                    items: { type: "string" },
                    description: "2 to 3 short, highly contextual quick replies (max 4-5 words each) the user can tap to answer your follow-up question.",
                  },
                },
                required: ["message", "search_terms", "quick_replies"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "beauty_advice" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let message = "I can help with cosmetic chemistry questions. Please try again.";
    let searchTerms: string[] = [];
    let quickReplies: string[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        message = parsed.message || message;
        searchTerms = Array.isArray(parsed.search_terms) ? parsed.search_terms.slice(0, 3) : [];
        quickReplies = Array.isArray(parsed.quick_replies) ? parsed.quick_replies.slice(0, 3) : [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Helper: strip Google redirect wrappers and flag ad links
    const getDirectUrl = (rawUrl: string): string => {
      try {
        if (rawUrl.includes("google.com/url")) {
          const urlObj = new URL(rawUrl);
          return urlObj.searchParams.get("url") || urlObj.searchParams.get("q") || rawUrl;
        }
        return rawUrl;
      } catch {
        return rawUrl;
      }
    };

    // Serper UK shopping search for each term
    const shoppingResults: Array<{
      term: string;
      products: Array<{ title: string; imageUrl: string; link: string; price?: string; source?: string }>;
    }> = [];

    for (const term of searchTerms) {
      try {
        const serperResp = await fetch("https://google.serper.dev/shopping", {
          method: "POST",
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: `${term} -bundle -set -kit -pack -multipack -system -duo -trio`,
            gl: "gb",
            num: 20,
          }),
        });

        if (serperResp.ok) {
          const serperData = await serperResp.json();
          const badWordsRegex = /\b(set|kit|bundle|pack|multipack|routine|collection|trio|gift|system|essentials|travel|mini|step|to go|twin|double)\b/i;
          const multiplierRegex = /\b(\d+x|2x|3x|\d+\s*pack|\d+\s*pcs|\d+\s*pieces|-step)\b/i;
          const validItems = (serperData.shopping || []).filter((item: any) => {
            const title = (item.title || "").toLowerCase();
            if (badWordsRegex.test(title)) return false;
            if (multiplierRegex.test(title)) return false;
            const link = item.link || "";
            if (link.includes("/aclk?") || link.includes("googleadservices.com")) return false;
            return true;
          });
          const items = validItems.slice(0, 2).map((item: any) => ({
            title: item.title || "",
            imageUrl: item.imageUrl || "",
            link: getDirectUrl(item.link || ""),
            price: item.price || "",
            source: item.source || "",
          }));
          shoppingResults.push({ term, products: items });
        } else {
          console.error(`Serper error for "${term}": ${serperResp.status}`);
          shoppingResults.push({ term, products: [] });
        }
      } catch (e) {
        console.error(`Serper fetch error for "${term}":`, e);
        shoppingResults.push({ term, products: [] });
      }
    }

    return new Response(
      JSON.stringify({ message, shopping: shoppingResults, quick_replies: quickReplies }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-beauty-advice error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
