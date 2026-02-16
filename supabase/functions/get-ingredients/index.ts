import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName } = await req.json();
    if (!productName) throw new Error("productName is required");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

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
            content: `You are a cosmetics and skincare ingredient expert. Given a product name, return its key active ingredients as a JSON array of strings. Only return well-known, factual ingredients. If unsure, return common ingredients for that product type. Return ONLY a valid JSON array, no markdown.`,
          },
          {
            role: "user",
            content: `What are the key ingredients in "${productName}"? Return a JSON array of 4-8 ingredient names.`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const ingredients = JSON.parse(clean);

    return new Response(JSON.stringify({ ingredients }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-ingredients error:", error);
    return new Response(JSON.stringify({ error: error.message, ingredients: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
