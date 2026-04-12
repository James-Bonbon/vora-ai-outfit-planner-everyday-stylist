import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("1. REQUEST RECEIVED: Initializing AI Brain...");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    console.log("2. Payload received. Size Check:", imageBase64?.length || 0);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("HARD STOP: LOVABLE_API_KEY is missing!");

    const prompt = "You are a wardrobe layout mapper. Output ONLY raw SVG code. ViewBox MUST be '0 0 1000 1000'. Map boundaries using <rect>. IDs required: 'left_shelves', 'center_hanging_shirts', 'center_drawers', 'right_hanging_dresses', 'floor_storage'. CRITICAL: Inside each box, you MUST draw a centered <text> label (e.g., 'Center Hanging Shirts'). Above the text, you MUST draw a minimalist SVG icon (using <path> or <circle>) representing that category (e.g., a shirt, dress, or drawers). DO NOT draw solid background blocks. Use transparent backgrounds.";

    console.log("3. Calling Lovable AI Gateway (gemini-2.5-flash)...");
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
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
              ]
            }
          ],
          temperature: 0.1,
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        throw new Error("Rate limited. Please try again in a moment.");
      }
      if (response.status === 402) {
        throw new Error("AI credits exhausted. Please add funds in Settings > Workspace > Usage.");
      }
      throw new Error("AI Gateway error: " + errText);
    }

    const aiData = await response.json();
    const rawSvg = aiData.choices?.[0]?.message?.content;

    // HARD STOP: If AI returns nothing, crash immediately.
    if (!rawSvg || rawSvg.trim() === "") {
      throw new Error("HARD STOP: AI returned empty content. Halting operation.");
    }

    const cleanSvg = rawSvg.replace(/```svg\n?/g, "").replace(/```\n?/g, "").trim();
    console.log("4. SUCCESS: SVG generated. Length:", cleanSvg.length);

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
