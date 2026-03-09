import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Fetch an image URL and return a base64 data URL */
async function toDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  const b64 = base64Encode(new Uint8Array(buf));
  const contentType = resp.headers.get("content-type");
  const mime = contentType && /^image\/(png|jpeg|webp|gif)/.test(contentType)
    ? contentType.split(";")[0]
    : "image/png";
  return `data:${mime};base64,${b64}`;
}

/** Generate a deterministic SHA-256 hash from userId + sorted garmentIds + bodyShape */
async function computeInputHash(userId: string, garmentIds: string[], bodyShape?: string | null): Promise<string> {
  const sorted = [...garmentIds].sort();
  const input = `${userId}:${sorted.join(",")}:${bodyShape || "none"}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = user.id;

    const { selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape: reqBodyShape } = await req.json();

    if (!selfieUrl || !garmentUrls?.length || !garmentIds?.length) {
      return new Response(
        JSON.stringify({ error: "selfieUrl, garmentUrls, and garmentIds are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's body_shape from profile
    const { data: profileData } = await supabaseUser
      .from("profiles")
      .select("body_shape")
      .eq("user_id", userId)
      .maybeSingle();
    const bodyShape = reqBodyShape || profileData?.body_shape || null;

    // Service-role client for cache and storage operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Compute input hash and check cache
    const inputHash = await computeInputHash(userId, garmentIds, bodyShape);

    const { data: cached } = await supabaseAdmin
      .from("generated_looks_cache")
      .select("image_path")
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cached?.image_path) {
      // Cache hit — return signed URL
      const { data: urlData } = await supabaseAdmin.storage
        .from("looks")
        .createSignedUrl(cached.image_path, 3600);

      return new Response(
        JSON.stringify({ image: urlData?.signedUrl, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Cache miss — run AI generation
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const [selfieDataUrl, ...garmentDataUrls] = await Promise.all([
      toDataUrl(selfieUrl),
      ...garmentUrls.map((u: string) => toDataUrl(u)),
    ]);

    const content: any[] = [
      {
        type: "text",
        text: `You are a fashion photographer creating a photorealistic editorial try-on image.

Given:
- A selfie/reference photo of a person
- One or more garment photos

Generate a SINGLE photorealistic full-body or three-quarter shot of the person wearing ALL the provided garment(s).

CHARACTER CONSISTENCY (CRITICAL):
- Preserve the person's IDENTITY: same face structure, jawline, nose shape, eye shape, skin tone, hair color, hair texture, hair length, body proportions, and build.
- The person MUST be immediately recognizable as the same individual.
- You MAY freely vary their facial expression (smiling, neutral, confident, etc.), head angle, gaze direction, and pose to create a natural, candid feel.
- Do NOT produce a "face swap" or "pasted head" look. The person should look like they were naturally photographed in these clothes.

CLOTHING ACCURACY (CRITICAL):
- Reproduce EVERY garment detail with pixel-level fidelity: exact colors, patterns, prints, textures, stitching, buttons, zippers, pocket placement, pocket shape, labels, logos, collar style, cuff style, and hemline.
- Do NOT simplify, omit, recolor, distort, or alter any garment detail. If a jacket has 4 pockets, show exactly 4 pockets in the correct positions.
- The clothing must look naturally worn on the person's body with realistic fit, draping, creasing, and shadow interaction based on their body shape.

SCENE & QUALITY:
- Clean, minimal background (soft studio or neutral setting).
- Professional fashion photography lighting with natural shadows.
- High resolution, sharp focus on person and clothing.
${occasion ? `- Style the overall mood to suit a "${occasion}" occasion.` : ""}
${weather ? `- The weather is ${weather}. Choose clothing layering and styling appropriate for this weather.` : ""}
${bodyShape ? `- The user has a ${bodyShape} body type. Ensure the generated image accurately reflects this body shape with proper fit and proportions.` : ""}
${desiredLook ? `- The user specifically requested this style: "${desiredLook}". Incorporate this aesthetic into the overall look.` : ""}
- Do NOT add any watermark, logo, text overlay, or branding.`,
      },
      {
        type: "image_url",
        image_url: { url: selfieDataUrl },
      },
    ];

    for (const dataUrl of garmentDataUrls) {
      content.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      return new Response(
        JSON.stringify({ error: "AI returned an invalid response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const message = data.choices?.[0]?.message;
    const imageBase64 = message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "AI could not generate the try-on image. Try different garments." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Upload generated image to storage
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

    // Step 4: Insert into cache
    await supabaseAdmin
      .from("generated_looks_cache")
      .insert({ input_hash: inputHash, image_path: filePath });

    // Return signed URL
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("looks")
      .createSignedUrl(filePath, 3600);

    return new Response(
      JSON.stringify({
        image: signedUrlData?.signedUrl,
        image_path: filePath,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("virtual-tryon error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
