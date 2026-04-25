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
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

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
            content: `You are a fashion expert. Analyze the clothing item in the image and return ONLY a JSON object with these fields:
- "name": a short descriptive name for the item (e.g. "Navy Polo Shirt")
- "category": one of "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"
- "color": the primary color (e.g. "Navy Blue")
- "material": best guess material (e.g. "Cotton", "Polyester", "Leather", "Denim")
- "brand": brand if visible, otherwise null
- "storage_zone": Based on the garment type, assign one of these exact IDs: "left_shelves" (folded items like sweaters, t-shirts), "center_hanging_shirts" (shirts, blouses, button-downs), "right_hanging_dresses" (dresses, coats, long garments), "center_drawers" (small items like socks, underwear, accessories), or "floor_storage" (shoes, bags, large accessories)
- "layout_metadata": an object with:
  - "garmentType": one of "coat", "jacket", "dress", "jumpsuit", "shirt", "knitwear", "trousers", "skirt", "shorts", "shoes", "bag", "hat", "accessory"
  - "bodyCoverage": one of "full_body", "upper_body", "lower_body", "feet", "accessory"
  - "lengthClass": one of "cropped", "waist", "hip", "thigh", "knee", "midi", "full_length"
  - "bulkClass": one of "light", "medium", "bulky"
  - "preferredPreviewScale": a number from 0.2 to 1.0 indicating visual importance in an editorial flat-lay preview
  - "bodyAnchors": for coats, jackets, dresses, shirts, sweaters, and other upper-body garments, estimate semantic landmarks as relative image coordinates from 0 to 1: { "leftShoulder": {"x": number, "y": number}, "rightShoulder": {"x": number, "y": number}, "necklineCenter": {"x": number, "y": number}, "waistCenter": {"x": number, "y": number} or null, "hemCenter": {"x": number, "y": number} or null }. Shoulders must sit on the real garment shoulder seam/outer shoulder, not the transparent PNG canvas edge.
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this clothing item." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 450,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Parse the JSON from the AI response
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const tags = JSON.parse(cleanContent);

    return new Response(JSON.stringify(tags), {
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
