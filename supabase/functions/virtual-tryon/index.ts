import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Fetch an image URL and return a base64 data URL (always as image/png for compatibility) */
async function toDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  const b64 = base64Encode(new Uint8Array(buf));
  // Use image/png as a safe fallback mime type that Gemini supports
  const contentType = resp.headers.get("content-type");
  const mime = contentType && /^image\/(png|jpeg|webp|gif)/.test(contentType)
    ? contentType.split(";")[0]
    : "image/png";
  return `data:${mime};base64,${b64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { selfieUrl, garmentUrls, occasion } = await req.json();

    if (!selfieUrl || !garmentUrls?.length) {
      return new Response(
        JSON.stringify({ error: "selfieUrl and at least one garmentUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Convert all image URLs to base64 data URLs to avoid format issues (e.g. AVIF)
    const [selfieDataUrl, ...garmentDataUrls] = await Promise.all([
      toDataUrl(selfieUrl),
      ...garmentUrls.map((u: string) => toDataUrl(u)),
    ]);

    // Build content array with selfie + garments
    const content: any[] = [
      {
        type: "text",
        text: `You are a fashion photographer creating a photorealistic editorial try-on image.

Given:
- A selfie/reference photo of a person
- One or more garment photos

Generate a SINGLE photorealistic full-body or three-quarter shot of the person wearing ALL the provided garment(s).

CHARACTER CONSISTENCY (CRITICAL):
- Preserve the person's IDENTITY: same face structure, jawline, nose shape, eye shape, skin tone, hair color, hair texture, hair length, body proportions, and build.
- The person MUST be immediately recognizable as the same individual.
- You MAY freely vary their facial expression (smiling, neutral, confident, etc.), head angle, gaze direction, and pose to create a natural, candid feel.
- Do NOT produce a "face swap" or "pasted head" look. The person should look like they were naturally photographed in these clothes.

CLOTHING ACCURACY (CRITICAL):
- Reproduce EVERY garment detail with pixel-level fidelity: exact colors, patterns, prints, textures, stitching, buttons, zippers, pocket placement, pocket shape, labels, logos, collar style, cuff style, and hemline.
- Do NOT simplify, omit, recolor, distort, or alter any garment detail. If a jacket has 4 pockets, show exactly 4 pockets in the correct positions.
- The clothing must look naturally worn on the person's body with realistic fit, draping, creasing, and shadow interaction based on their body shape.

SCENE & QUALITY:
- Clean, minimal background (soft studio or neutral setting).
- Professional fashion photography lighting with natural shadows.
- High resolution, sharp focus on person and clothing.
${occasion ? `- Style the overall mood to suit a "${occasion}" occasion.` : ""}
- Do NOT add any watermark, logo, text overlay, or branding.`,
      },
      {
        type: "image_url",
        image_url: { url: selfieDataUrl },
      },
    ];

    for (const dataUrl of garmentDataUrls) {
      content.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const imageData = message?.images?.[0]?.image_url?.url;
    const textContent = message?.content || "";

    if (!imageData) {
      return new Response(
        JSON.stringify({ error: "AI could not generate the try-on image. Try different garments.", text: textContent }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ image: imageData, text: textContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("virtual-tryon error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
