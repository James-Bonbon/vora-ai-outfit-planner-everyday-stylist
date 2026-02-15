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
    const { imageBase64, brand, name, category, color, material } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const messages: any[] = [
      {
        role: "system",
        content: `You are a fashion product expert. Given a clothing item image and details (especially the brand), identify the specific product and provide detailed care information.

Return ONLY a valid JSON object with these fields:
- "name": specific product name (e.g. "Ralph Lauren Classic Fit Polo")
- "material": specific material composition (e.g. "100% Cotton Piqué")
- "care": an object with:
  - "wash": detailed washing instructions for this specific material/product
  - "dry": detailed drying instructions
  - "iron": detailed ironing instructions
  - "special": any special care notes (e.g. "Do not bleach", "Dry clean recommended")
- "stain_guide": an array of 3 common stain scenarios for this type of garment, each with:
  - "stain": stain type (e.g. "Coffee")
  - "steps": brief removal instructions specific to this material
  - "warning": any material-specific warning or null

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: [] as any[],
      },
    ];

    // Add image if available
    if (imageBase64) {
      messages[1].content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      });
    }

    // Build text context
    const details = [
      brand ? `Brand: ${brand}` : "",
      name ? `Name: ${name}` : "",
      category ? `Category: ${category}` : "",
      color ? `Color: ${color}` : "",
      material ? `Material: ${material}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    messages[1].content.push({
      type: "text",
      text: `Identify this product and provide detailed care information. Known details: ${details}`,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleanContent);

    return new Response(JSON.stringify(result), {
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
