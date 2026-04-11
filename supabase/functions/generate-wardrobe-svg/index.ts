import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("1. EDGE FUNCTION HIT! Method:", req.method);

  if (req.method === "OPTIONS") {
    console.log("2. Handling CORS preflight.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    console.log("3. Payload received. Base64 exists?", !!imageBase64);

    if (!imageBase64) {
      throw new Error("Missing imageBase64 data from frontend");
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("4. Gemini Key retrieved from vault?", !!geminiKey);

    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is missing in Supabase Secrets!");
    }

    console.log("5. Sending request to Gemini API...");
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You output ONLY raw SVG code. No markdown. `<rect>` IDs: left_shelves, center_hanging_shirts, center_drawers, right_hanging_dresses, floor_storage. ViewBox 0 0 1000 1000.`,
                },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );

    console.log("6. Gemini API responded. Status:", geminiResponse.status);
    const aiData = await geminiResponse.json();

    if (aiData.error) {
      console.error("7. GEMINI ERROR:", aiData.error);
      throw new Error("Gemini API Error: " + aiData.error.message);
    }

    let svgString = aiData.candidates[0].content.parts[0].text;
    svgString = svgString
      .replace(/```svg\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    console.log("8. SVG generated successfully! Length:", svgString.length);

    return new Response(JSON.stringify({ svg: svgString }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("X. CRITICAL ERROR IN EDGE FUNCTION:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
