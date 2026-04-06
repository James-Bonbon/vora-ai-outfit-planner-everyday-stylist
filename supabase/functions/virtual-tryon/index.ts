import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Generate a deterministic SHA-256 hash from userId + sorted garmentIds + bodyShape */
async function computeInputHash(userId: string, garmentIds: string[], bodyShape?: string | null): Promise<string> {
  const sorted = [...garmentIds].sort();
  const input = `${userId}:${sorted.join(",")}:${bodyShape || "none"}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape: reqBodyShape, stylingInstruction } = await req.json();

    if (!selfieUrl || !garmentUrls?.length || !garmentIds?.length) {
      return new Response(JSON.stringify({ error: "selfieUrl, garmentUrls, and garmentIds are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValidUrl = (url: string) =>
      typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image"));

    if (!isValidUrl(selfieUrl)) {
      return new Response(JSON.stringify({ error: "Invalid selfie image. Please re-upload your selfie or use a different model." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invalidGarmentUrls = garmentUrls.filter((u: string) => !isValidUrl(u));
    if (invalidGarmentUrls.length > 0) {
      return new Response(JSON.stringify({ error: `${invalidGarmentUrls.length} garment image(s) could not be resolved. Please try again.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileData } = await supabaseUser
      .from("profiles")
      .select("body_shape")
      .eq("user_id", userId)
      .maybeSingle();
    const bodyShape = reqBodyShape || profileData?.body_shape || null;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check cache
    const inputHash = await computeInputHash(userId, garmentIds, bodyShape);
    const { data: cached } = await supabaseAdmin
      .from("generated_looks_cache")
      .select("image_path")
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cached?.image_path) {
      const { data: urlData } = await supabaseAdmin.storage
        .from("looks")
        .createSignedUrl(cached.image_path, 3600);
      return new Response(JSON.stringify({ image: urlData?.signedUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt — send URLs directly instead of base64 to avoid memory issues
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const promptText = `CRITICAL OVERRIDE - IDENTITY PRESERVATION IS YOUR #1 PRIORITY.
You are a precision Virtual Try-On engine. Your ONLY job is to change the user's clothing.

ABSOLUTE RULES FOR THE HEAD, FACE, AND HAIR:
1. DO NOT alter, repaint, or stylize the user's head, face, or hair under ANY circumstances.
2. The hair color, hair style, hair length, and exact facial identity MUST remain 100% identical to the provided reference selfie.
3. If the user has dark hair, it stays dark. If the hair is tied up, it stays tied up. Do not invent new hairstyles to match the outfit.

TASK:
Generate a photorealistic full-body or three-quarter shot of this exact person wearing ALL the provided garments naturally.

CLOTHING ACCURACY (Secondary Priority):
- Reproduce EVERY garment detail with pixel-level fidelity: exact colors, patterns, textures, collars, and hemlines.
- The clothing must look naturally worn with realistic fit, draping, and shadow interaction based on their body shape.

SCENE & CONTEXT:
- The background MUST be a plain, consistent beige studio backdrop. Do not generate environmental details, rooms, or complex settings.
- Professional fashion photography lighting.
- CRITICAL: Retain the exact hair color, hairstyle, and facial features of the reference subject. Only replace the clothing.
${occasion ? `- Style the overall outfit mood to suit a "${occasion}" occasion.` : ""}
${weather ? `- The weather is ${weather}. Layer appropriately.` : ""}
${bodyShape ? `- The user has a ${bodyShape.replace(/_/g, " ")} body type. Ensure the fit and silhouette flatter this shape.` : ""}
${stylingInstruction ? `- The garments MUST be styled exactly as follows: "${stylingInstruction}".` : ""}
${desiredLook ? `- Incorporate this specific aesthetic: "${desiredLook}".` : ""}
- NO watermarks, text, or logos.`;

    const content: any[] = [
      { type: "text", text: promptText },
      { type: "image_url", image_url: { url: selfieUrl } },
    ];

    for (const gUrl of garmentUrls) {
      content.push({ type: "image_url", image_url: { url: gUrl } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse AI response:", responseText.slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned an invalid response. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = data.choices?.[0]?.message;
    const imageBase64 = message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "AI could not generate the try-on image. Try different garments." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload result to storage
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `${userId}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("looks")
      .upload(filePath, binaryData, { contentType: "image/png" });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to save generated image");
    }

    // Cache the result
    await supabaseAdmin
      .from("generated_looks_cache")
      .insert({ input_hash: inputHash, image_path: filePath });

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("looks")
      .createSignedUrl(filePath, 3600);

    return new Response(JSON.stringify({
      image: signedUrlData?.signedUrl,
      image_path: filePath,
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("virtual-tryon error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});