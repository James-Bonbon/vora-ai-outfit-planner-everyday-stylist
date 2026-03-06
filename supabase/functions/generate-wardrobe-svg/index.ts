import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has a cached SVG
    const { data: profile } = await supabase
      .from("profiles")
      .select("closet_svg")
      .eq("user_id", user.id)
      .maybeSingle();

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a precise SVG generator. Your task is to analyze photos of physical closets/wardrobes and produce clean SVG line drawings of their structure.

Rules:
- Output ONLY the raw <svg> tag. No markdown, no explanation, no code blocks.
- Draw only the physical structure: shelves, racks, drawers, compartments, doors.
- Do NOT draw any clothes, shoes, accessories, or items inside.
- Use clean, minimalist 2D line-drawing style with thin strokes.
- Assign a unique HTML 'id' attribute to every compartment element (path, rect, etc).
- Use descriptive ids like: top-shelf, middle-rack, bottom-drawer-1, left-compartment, hanging-rod, etc.
- The SVG viewBox should be roughly 400x500.
- Use only <rect>, <path>, <line>, <polygon> elements.
- All strokes should be #D6D3D1 (stone-300) with stroke-width="2".
- All fills should be "none" or "transparent".`;

    const userPrompt = `Analyze this closet photo. Output ONLY a clean, minimalist 2D SVG line-drawing representing the physical compartments (shelves, racks, drawers). Do not draw clothes. Assign a unique HTML 'id' to every compartment 'path' or 'rect' (e.g., id='top-rack', id='drawer-1'). Do not wrap in markdown blocks, return only the raw <svg> tag.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    let svgContent = result.choices?.[0]?.message?.content || "";

    // Clean up: strip markdown code blocks if model wraps them
    svgContent = svgContent.replace(/```(?:xml|svg|html)?\s*/gi, "").replace(/```\s*/g, "").trim();

    // Validate it starts with <svg
    if (!svgContent.includes("<svg")) {
      return new Response(JSON.stringify({ error: "AI did not return valid SVG. Please try again." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract just the SVG tag
    const svgStart = svgContent.indexOf("<svg");
    const svgEnd = svgContent.lastIndexOf("</svg>") + 6;
    if (svgStart >= 0 && svgEnd > svgStart) {
      svgContent = svgContent.substring(svgStart, svgEnd);
    }

    // Save to profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ closet_svg: svgContent })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to save SVG:", updateError);
    }

    return new Response(JSON.stringify({ svg: svgContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-wardrobe-svg error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
