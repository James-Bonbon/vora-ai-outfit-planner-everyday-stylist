import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("1. EDGE FUNCTION HIT! Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    console.log("2. Payload received. Size Check:", imageBase64?.length || 0);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY is missing in secrets!");

    console.log("3. Calling default gemini-flash-latest...");

    // Using the exact endpoint from your AI Studio cURL
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
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
                  text: "You are a wardrobe layout mapper. Output ONLY raw SVG code. No markdown. Draw rect elements with these IDs: 'left_shelves', 'center_hanging_shirts', 'center_drawers', 'right_hanging_dresses', 'floor_storage'. ViewBox: 0 0 1000 1000.",
                },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );

    const aiData = await response.json();
    if (aiData.error) throw new Error("Gemini API Error: " + aiData.error.message);

    const rawSvg = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawSvg) throw new Error("AI returned empty content.");

    const cleanSvg = rawSvg
      .replace(/```svg\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    console.log("4. SUCCESS: SVG generated.");

    return new Response(JSON.stringify({ svg: cleanSvg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("CRITICAL ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
