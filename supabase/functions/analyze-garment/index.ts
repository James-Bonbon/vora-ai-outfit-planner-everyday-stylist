import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch & base64-encode the image for Vision AI
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
    const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
    console.log(`Image for AI: ${imgBytes.length} bytes`);
    const base64 = uint8ToBase64(imgBytes);
    const mime = imageUrl.includes(".png") ? "image/png" : "image/jpeg";

    // AI Vision Analysis — metadata only
    const prompt = `Identify this clothing item. Return a JSON object with 'category' (one of "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"), 'color' (the primary color), 'material' (if visually obvious, else null), and 'name' (a brief description like "Navy Polo Shirt").

CRUCIAL BRAND INSTRUCTION: Look closely for a brand logo, text, or neck tag in the image. If you are highly confident you recognize the brand, return it in the 'brand' field. If you cannot clearly see the brand or are unsure, you MUST return null for the 'brand' field. Do not guess or hallucinate brands.

Return ONLY valid JSON, no markdown, no code fences.`;

    const attempts = [
      { model: "google/gemini-3-flash-preview", tokenParam: "max_tokens" },
      { model: "openai/gpt-5-mini", tokenParam: "max_completion_tokens" },
    ];

    let lastError = "";

    for (const { model, tokenParam } of attempts) {
      console.log(`Trying model: ${model}`);
      const body: Record<string, unknown> = {
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
      };
      body[tokenParam] = 300;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const tags = JSON.parse(clean);

        return new Response(JSON.stringify(tags), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errText = await response.text();
      console.error(`Model ${model} failed: ${response.status}`, errText);
      lastError = `${model}: ${response.status}`;

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    throw new Error(`All AI models failed. Last: ${lastError}`);
  } catch (error) {
    console.error("analyze-garment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
