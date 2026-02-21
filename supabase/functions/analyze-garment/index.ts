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

/**
 * Uses Gemini image generation to redraw a garment as a clean studio flat-lay.
 * Returns the processed image as a Uint8Array, or null if generation fails.
 */
async function generateStudioFlatLay(rawImageUrl: string, apiKey: string): Promise<Uint8Array | null> {
  try {
    // Fetch raw image and convert to base64
    const imgResp = await fetch(rawImageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgResp.ok) throw new Error(`Failed to fetch raw image: ${imgResp.status}`);
    const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
    const base64 = uint8ToBase64(imgBytes);
    const mime = rawImageUrl.includes(".png") ? "image/png" : "image/jpeg";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are a professional e-commerce fashion retoucher. I am providing a photo of a clothing item (it may be crumpled or on a messy background). Redraw this exact item as a flawless, perfectly flat-lay studio packshot. Remove all wrinkles, folds, and messy backgrounds. Place the item perfectly centered on a solid light grey background (Hex #F4F4F4). Preserve the exact colors, brand logos, collar shape, and patterns of the original garment as accurately as possible. Output ONLY the image, no text, no watermarks.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI studio flat-lay error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageBase64) {
      console.error("AI studio flat-lay returned no image");
      return null;
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const processedBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    console.log(`AI studio flat-lay processed image: ${processedBytes.length} bytes`);
    return processedBytes;
  } catch (e) {
    console.error("AI studio flat-lay failed (fallback to raw):", e);
    return null;
  }
}

/**
 * Uploads processed image bytes to temp-uploads/processed/ and returns the public URL.
 */
async function uploadProcessedImage(bytes: Uint8Array): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const path = `processed/${crypto.randomUUID()}.jpg`;
    const resp = await fetch(`${supabaseUrl}/storage/v1/object/temp-uploads/${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
      },
      body: bytes,
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Upload processed image failed:", resp.status, t);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/temp-uploads/${path}`;
  } catch (e) {
    console.error("Upload processed image error:", e);
    return null;
  }
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

    // ── Step 1: AI Studio Flat-Lay via Gemini Image Generation ─────────────
    let analysisImageUrl = imageUrl; // fallback to raw if AI flat-lay fails
    let processedImageUrl: string | null = null;

    const processedBytes = await generateStudioFlatLay(imageUrl, apiKey);
    if (processedBytes) {
      const uploadedUrl = await uploadProcessedImage(processedBytes);
      if (uploadedUrl) {
        processedImageUrl = uploadedUrl;
        analysisImageUrl = uploadedUrl; // AI analyses the clean studio image
        console.log("Using AI-generated studio flat-lay for analysis.");
      }
    }

    // ── Step 2: Fetch & base64-encode the image for Vision AI ────────────────
    const imgResp = await fetch(analysisImageUrl);
    if (!imgResp.ok) throw new Error(`Failed to fetch image for AI: ${imgResp.status}`);
    const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
    console.log(`Image for AI: ${imgBytes.length} bytes`);
    const base64 = uint8ToBase64(imgBytes);
    const mime = analysisImageUrl.includes(".png") ? "image/png" : "image/jpeg";

    // ── Step 3: AI Vision Analysis ───────────────────────────────────────────
    const prompt = `Identify this clothing item. Return a JSON object with 'category' (one of "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"), 'color' (the primary color), 'material' (if visually obvious, else null), and 'name' (a brief description like "Navy Polo Shirt").

CRUCIAL BRAND INSTRUCTION: Look closely for a brand logo, text, or neck tag in the image. If you are highly confident you recognize the brand, return it in the 'brand' field. If you cannot clearly see the brand or are unsure, you MUST return null for the 'brand' field. Do not guess or hallucinate brands.

Return ONLY valid JSON, no markdown, no code fences.`;

    const attempts = [
      { model: "openai/gpt-5-mini", tokenParam: "max_completion_tokens" },
      { model: "google/gemini-2.5-flash", tokenParam: "max_tokens" },
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

        // ── Step 4: Return metadata + processed image URL ──────────────────
        return new Response(JSON.stringify({ ...tags, processedImageUrl }), {
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
