import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Build content array with selfie + garments
    const content: any[] = [
      {
        type: "text",
        text: `You are a fashion AI that creates photorealistic virtual try-on images.

Given:
- A selfie/reference photo of a person
- One or more garment photos

Generate a single photorealistic image of the person wearing the garment(s). 
Maintain the person's face, body shape, skin tone, and hair exactly.
The clothing should look naturally worn — proper fit, draping, shadows, and wrinkles.
${occasion ? `The styling should suit a "${occasion}" occasion.` : ""}
Keep the background simple and clean.
Make it look like a real fashion photo, not a collage.`,
      },
      {
        type: "image_url",
        image_url: { url: selfieUrl },
      },
    ];

    for (const url of garmentUrls) {
      content.push({
        type: "image_url",
        image_url: { url },
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
          model: "google/gemini-2.5-flash-image",
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
