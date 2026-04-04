import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse body
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = mimeType || "image/jpeg";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // 3. Call Lovable AI Gateway with vision
    const prompt = `You are an expert fashion AI and computer vision surveyor. Analyze this image and detect ALL distinct clothing items (Tops, Bottoms, Outerwear, Shoes, Accessories). Draw a tight bounding box around each item.

You MUST respond with ONLY a raw, minified JSON array. Do not include any markdown, backticks, or conversational text.

Format: [{"category": "Tops", "ymin": 0.1, "xmin": 0.1, "ymax": 0.5, "xmax": 0.5}]

Each object must have:
- "category": one of "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"
- "ymin", "xmin", "ymax", "xmax": relative coordinates from 0.0 to 1.0 representing the bounding box`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // 4. Safety parser — clean markdown fences
    const data = await response.json();
    let rawText = data.choices?.[0]?.message?.content || "[]";
    rawText = rawText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

    let boundingBoxes;
    try {
      boundingBoxes = JSON.parse(rawText);
      if (!Array.isArray(boundingBoxes)) {
        boundingBoxes = [boundingBoxes];
      }
    } catch {
      console.error("Failed to parse AI response:", rawText);
      throw new Error("Failed to parse bounding box response from AI");
    }

    console.log(`Detected ${boundingBoxes.length} garment(s)`);

    return new Response(JSON.stringify(boundingBoxes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("detect-garments error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
