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
    const { category, search } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const searchClause = search
      ? `matching the search query "${search}"`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a UK skincare product database. Return a JSON array of 6 real products. Each object MUST have:
- "name": full product name
- "brand": brand name
- "product_type": e.g. "Cleanser", "Moisturiser", "SPF", "Serum", "Toner", "Exfoliant", "Eye Cream", "Mask"
- "rating": number out of 5 (e.g. 4.5)
- "key_ingredients": array of 3-4 key active ingredients
- "description": one concise sentence about benefits
- "how_to_use": one sentence on application method
- "volume": product size (e.g. "50ml", "200ml")
- "skin_type": array of suitable skin types (e.g. ["Oily","Combination"])
- "routine_step": one of "1-Cleanse","2-Tone","3-Treat","4-Moisturise","5-Protect"
- "image_url": a working direct URL to the official product image on the brand's website, Boots, or Superdrug

Only real products available in the UK. Return ONLY valid JSON array, no markdown.`,
          },
          {
            role: "user",
            content: `List 6 popular ${category || "skincare"} products ${searchClause} available in the UK.`,
          },
        ],
        max_tokens: 4000,
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
    let clean = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    
    // Find JSON array boundaries
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("No JSON array in response");
    clean = clean.substring(start, end + 1);
    
    // Fix common LLM JSON issues
    clean = clean.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}").replace(/[\x00-\x1F\x7F]/g, "");
    
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
