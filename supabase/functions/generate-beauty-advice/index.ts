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

    const { query, products } = await req.json();
    if (!query) throw new Error("Missing 'query' field");

    // 1. AI call with strict guardrails + structured JSON output via tool calling
    const systemPrompt = `CRITICAL: You are a cosmetic chemistry AI, not a dermatologist. You may ONLY recommend generic active ingredients (e.g., '10% Niacinamide Serum'). NEVER recommend specific brand names. NEVER diagnose medical conditions.

The user has these products on their shelf: ${JSON.stringify(products || [])}

Based on their question, provide helpful cosmetic chemistry advice and suggest generic product types they should search for. When generating search terms, you MUST use short, generic e-commerce keywords (maximum 3 words). Never use conversational phrases.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "beauty_advice",
              description: "Return beauty advice with search terms for product recommendations",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "Conversational advice text for the user. Never mention specific brand names.",
                  },
                  search_terms: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of SHORT, targeted e-commerce search queries (MAX 3 words per term). Example: 'Salicylic Acid Cleanser'. NEVER use long descriptive phrases.",
                  },
                },
                required: ["message", "search_terms"],
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

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        message = parsed.message || message;
        searchTerms = Array.isArray(parsed.search_terms) ? parsed.search_terms.slice(0, 3) : [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // 2. Serper UK shopping search for each term
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
            q: `${term} -bundle -set -kit -pack -multipack`,
            gl: "gb",
            num: 4,
          }),
        });

        if (serperResp.ok) {
          const serperData = await serperResp.json();
          const badWordsRegex = /\b(set|kit|bundle|pack|multipack|routine|collection|duo|trio|gift)\b/i;
          const validItems = (serperData.shopping || []).filter((item: any) => {
            const title = item.title || "";
            return !badWordsRegex.test(title);
          });
          const items = validItems.slice(0, 2).map((item: any) => ({
            title: item.title || "",
            imageUrl: item.imageUrl || "",
            link: item.link || "",
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
      JSON.stringify({ message, shopping: shoppingResults }),
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
