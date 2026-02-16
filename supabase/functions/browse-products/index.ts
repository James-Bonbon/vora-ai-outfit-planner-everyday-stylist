import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, skinType } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a UK-based skincare and beauty expert. Return a JSON array of 8 product recommendations. Each product object must have:
- "name": full product name
- "brand": brand name  
- "product_type": category (e.g. "Cleanser", "Moisturiser", "SPF", "Serum", "Toner", "Exfoliant", "Eye Cream", "Mask", "Oil", "Lip Care")
- "price": price in GBP as a string (e.g. "£12.99")
- "rating": a rating out of 5 as a number (e.g. 4.5)
- "key_ingredients": array of 2-3 key ingredients
- "description": a concise one-sentence benefit description
- "routine_step": one of "1-Cleanse", "2-Tone", "3-Treat", "4-Moisturise", "5-Protect"

Only recommend real products available in the UK (Boots, Superdrug, Cult Beauty, SpaceNK, etc).
Return ONLY valid JSON array, no markdown.`,
          },
          {
            role: "user",
            content: `Recommend 8 popular ${category || "skincare"} products${skinType ? ` suitable for ${skinType} skin` : ""} available in the UK.`,
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const products = JSON.parse(clean);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("browse-products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
