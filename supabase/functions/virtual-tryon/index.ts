import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Strip query strings from URLs so that short-lived signed-URL tokens
 * don't bust the cache when the underlying storage path hasn't changed.
 */
function stripQueryString(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function normalize(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  return JSON.stringify(v);
}

async function computeInputHash(parts: Record<string, string>): Promise<string> {
  // Deterministic JSON: sorted keys
  const keys = Object.keys(parts).sort();
  const canonical = JSON.stringify(keys.map((k) => [k, parts[k]]));
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    const {
      selfieUrl,
      garmentUrls,
      garmentIds,
      occasion,
      desiredLook,
      weather,
      stylingInstruction,
      bodyShape: reqBodyShape,
    } = await req.json();

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

    // Pre-flight: verify all image URLs are actually fetchable (2XX) before
    // sending to Photoroom. Photoroom fails opaquely when an upstream image 404s.
    const urlsToCheck = [selfieUrl, ...garmentUrls];
    const headChecks = await Promise.all(
      urlsToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: "HEAD" });
          return { url: u, ok: r.ok, status: r.status };
        } catch {
          return { url: u, ok: false, status: 0 };
        }
      })
    );
    const broken = headChecks.filter((c) => !c.ok);
    if (broken.length > 0) {
      const isSelfie = broken.some((b) => b.url === selfieUrl);
      const msg = isSelfie
        ? "Your selfie image could not be loaded. Please re-upload it in your profile."
        : "One or more garment images could not be loaded. Please re-upload them.";
      console.error("Pre-flight URL check failed:", broken);
      return new Response(JSON.stringify({ error: msg, broken }), {
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

    // Build a comprehensive cache key from ALL generation-affecting inputs.
    // URLs are stripped of query strings so signed-URL tokens don't bust the cache.
    const sortedGarmentIds = [...garmentIds].sort();
    const stableGarmentUrls = garmentUrls.map((u: string) => stripQueryString(u)).sort();

    const hashParts: Record<string, string> = {
      userId,
      garmentIds: sortedGarmentIds.join(","),
      garmentUrls: stableGarmentUrls.join(","),
      selfieUrl: stripQueryString(selfieUrl),
      bodyShape: normalize(bodyShape),
      occasion: normalize(occasion),
      desiredLook: normalize(desiredLook),
      weather: normalize(weather),
      stylingInstruction: normalize(stylingInstruction),
    };

    const inputHash = await computeInputHash(hashParts);

    // Check cache
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

    // --- Scene preset selection ---
    // Photoroom's Virtual Model API supports a limited set of scene presets.
    // It does NOT support free-text styling prompts, weather context, or custom
    // occasion descriptions. We map the available inputs to the closest preset.
    //
    // LIMITATION: desiredLook, weather, and stylingInstruction are included in the
    // cache hash (so changing them forces a new generation), but Photoroom only
    // uses the scene preset to vary the background/setting. The garment arrangement
    // and model pose are AI-driven and cannot be controlled via text prompts.
    // If a future provider supports free-text prompts, these fields are ready to use.
    let scenePreset = "studio";

    // Combine all text signals for preset mapping
    const textSignals = [
      normalize(occasion),
      normalize(desiredLook),
      normalize(weather),
      normalize(stylingInstruction),
    ].join(" ");

    if (textSignals.includes("street") || textSignals.includes("athleisure") || textSignals.includes("urban")) {
      scenePreset = "street";
    } else if (textSignals.includes("outdoor") || textSignals.includes("rain") || textSignals.includes("snow") || textSignals.includes("cold")) {
      scenePreset = "street";
    } else if (textSignals.includes("casual") || textSignals.includes("bohemian") || textSignals.includes("brunch") || textSignals.includes("cafe")) {
      scenePreset = "cafe";
    } else if (textSignals.includes("formal") || textSignals.includes("work") || textSignals.includes("office") || textSignals.includes("minimalist") || textSignals.includes("preppy")) {
      scenePreset = "concretestudio";
    } else if (textSignals.includes("party") || textSignals.includes("date") || textSignals.includes("evening") || textSignals.includes("night")) {
      scenePreset = "cafe";
    }

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
        console.error("Photoroom structured error:", JSON.stringify(errJson));
        // Photoroom nests the message: { error: { message: "..." } }
        const detail =
          (typeof errJson?.error === "string" && errJson.error) ||
          errJson?.error?.message ||
          errJson?.message ||
          (Array.isArray(errJson?.errors) && errJson.errors[0]?.message) ||
          "Failed to generate try-on";
        throw new Error(`Photoroom API Error: ${detail}`);
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
