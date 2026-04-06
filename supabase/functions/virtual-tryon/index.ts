import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const { selfieUrl, garmentUrls, garmentIds, occasion, styleVibe, bodyShape: reqBodyShape } = await req.json();

    if (!selfieUrl || !garmentUrls?.length || !garmentIds?.length) {
      return new Response(JSON.stringify({ error: "selfieUrl, garmentUrls, and garmentIds are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValidUrl = (url: string) =>
      typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

    if (!isValidUrl(selfieUrl)) {
      return new Response(JSON.stringify({ error: "Invalid selfie URL. Please re-upload your selfie." }), {
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

    // --- Photoroom Virtual Model API ---
    const photoroomKey = Deno.env.get("PHOTOROOM_API_KEY");
    if (!photoroomKey) throw new Error("PHOTOROOM_API_KEY is missing from Supabase secrets");

    const formData = new FormData();

    // Primary garment via URL (no blob download)
    formData.append("imageUrl", garmentUrls[0]);
    formData.append("removeBackground", "false");
    formData.append("referenceBox", "originalImage");

    // Virtual Model mode with custom selfie
    formData.append("virtualModel.mode", "ai.auto");
    formData.append("virtualModel.model.custom.imageUrl", selfieUrl);

    // Additional garments for full outfits
    if (garmentUrls.length > 1) {
      for (let i = 1; i < garmentUrls.length; i++) {
        formData.append(`virtualModel.additionalProductImages[${i - 1}].imageUrl`, garmentUrls[i]);
      }
    }

    // Map style vibe to a scene preset
    let scenePreset = "studio";
    const vibe = (styleVibe || "").toLowerCase();
    if (vibe.includes("street")) scenePreset = "street";
    else if (vibe.includes("casual")) scenePreset = "cafe";
    else if (vibe.includes("minimalist")) scenePreset = "concretestudio";
    formData.append("virtualModel.scene.preset.name", scenePreset);

    const response = await fetch("https://image-api.photoroom.com/v2/edit", {
      method: "POST",
      headers: { "x-api-key": photoroomKey },
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Photoroom credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (contentType.includes("application/json")) {
        const errJson = await response.json();
        console.error("Photoroom structured error:", errJson);
        throw new Error(`Photoroom API Error: ${errJson.error || errJson.message || "Failed to generate try-on"}`);
      } else {
        const errText = await response.text();
        console.error("Photoroom raw error:", response.status, errText);
        throw new Error(`Photoroom API error: ${response.status}`);
      }
    }

    if (!contentType.includes("image/")) {
      throw new Error("Photoroom did not return a valid image.");
    }

    const resultBuffer = await response.arrayBuffer();
    const binaryData = new Uint8Array(resultBuffer);

    // Upload result to storage
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
