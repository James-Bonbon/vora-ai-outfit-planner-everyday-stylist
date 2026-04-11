// supabase/functions/generate-wardrobe-svg/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error("Missing imageBase64 data from frontend");
    }

    // Call the FREE Gemini 2.5 Pro API using the Base64 data
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an AI wardrobe layout mapper. You output ONLY raw SVG code. No markdown blocks, no formatting, no explanations. Just the <svg> element.
              
              RULES:
              1. Output an SVG with exactly viewBox="0 0 1000 1000" and preserveAspectRatio="none".
              2. Imagine this 1000x1000 SVG canvas is a transparent sheet of glass placed perfectly over the provided image. The <rect> elements you draw MUST be precise bounding boxes that perfectly frame the physical shelves, drawers, and hanging areas shown in the photo. Do not include an <image> background tag; output only the transparent coordinates.
              3. Analyze the provided image of the closet.
              4. Draw <rect> elements over the 5 primary storage zones you detect. 
              5. You MUST use these exact IDs for the rectangles:
                 - id="left_shelves"
                 - id="center_hanging_shirts"
                 - id="center_drawers"
                 - id="right_hanging_dresses"
                 - id="floor_storage"
              6. Estimate the x, y, width, and height as a percentage of the 1000x1000 canvas.`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      },
    );

    const aiData = await geminiResponse.json();

    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    let svgString = aiData.candidates[0].content.parts[0].text;

    // Clean up any markdown the AI accidentally included
    svgString = svgString
      .replace(/```svg\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Return the key "svg" exactly as line 88 in WardrobePage.tsx expects: `if (data?.svg)`
    return new Response(JSON.stringify({ svg: svgString }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
