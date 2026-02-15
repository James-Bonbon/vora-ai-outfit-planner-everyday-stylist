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
        text: `You are a fashion AI that creates photorealistic virtual try-on images.

Given:
- A selfie/reference photo of a person
- One or more garment photos

Generate a single photorealistic image of the person wearing the garment(s).
CRITICAL: Maintain the person's face, body shape, skin tone, hair, and all facial features EXACTLY as they appear in the selfie. The person must be clearly recognizable — preserve their identity perfectly.
The clothing should look naturally worn — proper fit, draping, shadows, and wrinkles.
${occasion ? `The styling should suit a "${occasion}" occasion.` : ""}
Keep the background simple and clean.
Make it look like a real fashion photo, not a collage.
Do NOT add any watermark, logo, text overlay, or branding to the image.`,
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
