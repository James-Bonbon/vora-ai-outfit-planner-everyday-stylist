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
    const { products, profile } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const productList = products.map((p: any) =>
      `- ${p.name} (${p.product_type}, ingredients: ${(p.ingredients || []).join(", ")})`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a skincare expert. Given the user's product inventory, build a personalised AM and PM routine and perform a gap analysis.

Return ONLY a JSON object with:
- "am_routine": array of objects { "step": "1-Cleanse" | "2-Tone" | "3-Treat" | "4-Moisturise" | "5-Protect", "product_name": string, "why": string (1 sentence explaining benefit) }
- "pm_routine": same format (no SPF needed at night)
- "gaps": array of objects { "step": string, "recommendation": string (product suggestion with approx UK price in £) }

Only include steps where user has products. In gaps, list any missing critical steps. Use UK English spelling. Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Here are my skincare products:\n${productList}\n\nProfile: ${profile?.gender || "not specified"}, age approximate.`,
          },
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    if (!content || content.trim().length === 0) {
      throw new Error("AI returned empty response");
    }

    // Robust JSON extraction
    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.search(/[\{\[]/);
    const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("No valid JSON found in AI response");
    }
    
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    
    let routine;
    try {
      routine = JSON.parse(cleaned);
    } catch (_e) {
      // Fix trailing commas and control chars
      cleaned = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, "");
      routine = JSON.parse(cleaned);
    }

    return new Response(JSON.stringify(routine), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
