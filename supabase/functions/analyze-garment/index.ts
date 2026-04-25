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
    const prompt = `You are an expert fashion AI and computer vision surveyor. The user has uploaded an image that may contain a SINGLE clothing item, or MULTIPLE clothing items laid out with space between them. 

Analyze the image and return a JSON ARRAY of objects (one object for every distinct clothing item you see). 

For EACH item, provide:
- 'category': (one of "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear")
- 'color': (primary color)
- 'material': (if obvious, else null)
- 'name': (brief description, e.g., "Navy Polo Shirt")
- 'brand': (ONLY if you clearly see a logo or neck tag, otherwise null. Do not hallucinate.)
- 'storage_zone': Based on the garment type, you MUST assign it to one of these precise IDs: 'left_shelves' (for folded items like sweaters, t-shirts), 'center_hanging_shirts' (for shirts, blouses, button-downs), 'right_hanging_dresses' (for dresses, coats, long garments), 'center_drawers' (for small items like socks, underwear, accessories), or 'floor_storage' (for shoes, bags, large accessories). Return this ID string.
- 'layout_metadata': {
  "garmentType": one of "coat", "jacket", "dress", "jumpsuit", "shirt", "knitwear", "trousers", "skirt", "shorts", "shoes", "bag", "hat", "accessory",
  "bodyCoverage": one of "full_body", "upper_body", "lower_body", "feet", "accessory",
  "lengthClass": one of "cropped", "waist", "hip", "thigh", "knee", "midi", "full_length",
  "bulkClass": one of "light", "medium", "bulky",
  "preferredPreviewScale": number from 0.2 to 1.0 for editorial flat-lay visual importance,
  "visibleAlphaBounds": tight visible garment bounds if discernible, as pixel coordinates {"x": number, "y": number, "width": number, "height": number},
  "leftUpperAnchor" and "rightUpperAnchor": pixel coordinates on the actual visible upper-body span, not transparent canvas edges. Use shoulder seam/strap/upper bodice extremes for sleeveless, asymmetric, strapless, and one-shoulder garments,
  "upperBodyWidthAnchor": pixel distance between leftUpperAnchor and rightUpperAnchor,
  "necklineCenter", "waistCenter", "hemCenter": pixel coordinates if visible, otherwise null,
  "confidence": number from 0 to 1 for landmark reliability,
  "bodyAnchors": backward-compatible relative coordinates from 0 to 1 using the same upper anchors as shoulders when true shoulder seams are ambiguous.
}
- 'boundingBox': { "ymin": number, "xmin": number, "ymax": number, "xmax": number } 
  (Provide the relative coordinates from 0.0 to 1.0 representing the box around this specific item. For example, if an item is in the top left quadrant, it might be ymin: 0.0, xmin: 0.0, ymax: 0.5, xmax: 0.5)

CRITICAL: You MUST return a valid JSON ARRAY [ { ... }, { ... } ]. Do not wrap it in markdown or code fences.`;

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
      body[tokenParam] = 1500;

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
        const content = data.choices?.[0]?.message?.content || "[]";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        let tagsArray;
        try {
          tagsArray = JSON.parse(clean);
          if (!Array.isArray(tagsArray)) {
            tagsArray = [tagsArray];
          }
        } catch (_parseError) {
          throw new Error("Failed to parse AI JSON array response");
        }

        return new Response(JSON.stringify(tagsArray), {
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
