// supabase/functions/generate-wardrobe-map/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { view_id, image_url } = await req.json();

    if (!view_id || !image_url) {
      throw new Error("Missing view_id or image_url");
    }

    // 1. Fetch the image and convert to Base64 for Gemini
    const imageReq = await fetch(image_url);
    const imageBlob = await imageReq.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = imageBlob.type || "image/jpeg";

    // 2. Call the FREE Gemini API
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
              2. Analyze the provided image of the closet.
              3. Draw <rect> elements over the 5 primary storage zones you detect. 
              4. You MUST use these exact IDs for the rectangles:
                 - id="left_shelves"
                 - id="center_hanging_shirts"
                 - id="center_drawers"
                 - id="right_hanging_dresses"
                 - id="floor_storage"
              5. Estimate the x, y, width, and height as a percentage of the 1000x1000 canvas.`,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Keep it highly mathematical and strict
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

    // 3. Save the AI's SVG back to your Supabase Database
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { error: updateError } = await supabaseClient
      .from("wardrobe_views")
      .update({ svg_string: svgString })
      .eq("id", view_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, svg_string: svgString }), {
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
