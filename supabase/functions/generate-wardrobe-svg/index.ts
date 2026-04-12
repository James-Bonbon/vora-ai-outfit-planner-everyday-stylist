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

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("HARD STOP: GEMINI_API_KEY is missing in Supabase Secrets!");

    const prompt = "You are a wardrobe layout mapper. Output ONLY raw SVG code. No markdown. Draw <rect> elements with these IDs: 'left_shelves', 'center_hanging_shirts', 'center_drawers', 'right_hanging_dresses', 'floor_storage'. Imagine this 1000x1000 canvas is a transparent glass sheet over the closet image. Map the physical boundaries accurately.";

    console.log("3. Calling Gemini 2.5 Pro API...");
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.1 }
        })
      }
    );

    const aiData = await response.json();

    // HARD STOP: If Gemini throws an error, do not proceed.
    if (aiData.error) throw new Error("HARD STOP - Gemini API Error: " + aiData.error.message);

    const rawSvg = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    // HARD STOP: If Gemini returns nothing, crash immediately. Do NOT fallback to auto-trace.
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
