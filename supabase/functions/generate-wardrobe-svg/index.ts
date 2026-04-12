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
    const { imagesBase64 } = await req.json();
    if (!imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length === 0) {
      throw new Error("HARD STOP: Missing imagesBase64 array from frontend.");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("HARD STOP: LOVABLE_API_KEY is missing!");

    const prompt = "You are a wardrobe layout mapper. You may receive 1 or 2 images. If 2 images, they are the left and right halves of a sliding-door wardrobe; mentally stitch them into ONE layout. Output ONLY raw SVG code. ViewBox MUST be '0 0 1000 1000'. Map the boundaries using strictly <rect> elements. DO NOT output <text>, <path>, or <circle>. IDs required: 'left_shelves', 'center_hanging_shirts', 'center_drawers', 'right_hanging_dresses', 'floor_storage'.";

    const imageParts = imagesBase64.map((base64: string) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64}` },
    }));

    console.log(`Calling AI with ${imagesBase64.length} image(s)...`);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                ...imageParts,
              ],
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) throw new Error("Rate limited. Please try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI Gateway error: " + errText);
    }

    const aiData = await response.json();
    const rawSvg = aiData.choices?.[0]?.message?.content;

    if (!rawSvg || rawSvg.trim() === "") {
      throw new Error("HARD STOP: AI returned empty content.");
    }

    const cleanSvg = rawSvg.replace(/```svg\n?/g, "").replace(/```\n?/g, "").trim();
    console.log("SUCCESS: SVG generated. Length:", cleanSvg.length);

    return new Response(JSON.stringify({ svg: cleanSvg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("CRITICAL ERROR:", err.message || err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
