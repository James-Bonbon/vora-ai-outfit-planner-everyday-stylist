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
  const keys = Object.keys(parts).sort();
  const canonical = JSON.stringify(keys.map((k) => [k, parts[k]]));
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Body-zone classification ──────────────────────────────────────────
type Garment = {
  id: string;
  url: string;
  category: string | null;
  name: string | null;
  brand: string | null;
};

const OUTERWEAR_KW = ["outerwear", "coat", "jacket", "blazer", "trench", "parka", "puffer", "overcoat"];
const TOP_KW = ["top", "shirt", "tee", "sweater", "knit", "polo", "camisole", "cardigan", "hoodie", "blouse", "tank"];
const DRESS_KW = ["dress", "gown", "jumpsuit", "romper"];
const BOTTOM_KW = ["bottom", "trouser", "pant", "jean", "skirt", "short", "chino", "sweatpant", "legging"];
const SHOE_KW = ["shoe", "boot", "sneaker", "heel", "loafer", "sandal", "trainer"];
const ACCESSORY_KW = ["accessory", "bag", "hat", "scarf", "belt", "jewelry", "watch", "sunglasses"];

function classify(g: Garment): "outerwear" | "top" | "dress" | "bottom" | "shoe" | "accessory" | "other" {
  const hay = `${g.category ?? ""} ${g.name ?? ""}`.toLowerCase();
  if (OUTERWEAR_KW.some((k) => hay.includes(k))) return "outerwear";
  if (DRESS_KW.some((k) => hay.includes(k))) return "dress";
  if (TOP_KW.some((k) => hay.includes(k))) return "top";
  if (BOTTOM_KW.some((k) => hay.includes(k))) return "bottom";
  if (SHOE_KW.some((k) => hay.includes(k))) return "shoe";
  if (ACCESSORY_KW.some((k) => hay.includes(k))) return "accessory";
  return "other";
}

function describe(g: Garment): string {
  const parts = [g.brand, g.name].filter(Boolean);
  return parts.length ? parts.join(" ") : (g.category ?? "garment");
}

function buildOutfitPrompt(args: {
  garments: Garment[];
  occasion: string | null;
  desiredLook: string | null;
  weather: string | null;
  bodyShape: string | null;
  stylingInstruction: string | null;
}): string {
  const { garments, occasion, desiredLook, weather, bodyShape, stylingInstruction } = args;

  const byZone = {
    outerwear: [] as Garment[],
    dress: [] as Garment[],
    top: [] as Garment[],
    bottom: [] as Garment[],
    shoe: [] as Garment[],
    accessory: [] as Garment[],
    other: [] as Garment[],
  };
  for (const g of garments) byZone[classify(g)].push(g);

  const lines: string[] = [];

  if (byZone.outerwear.length) {
    const list = byZone.outerwear.map(describe).join(" and ");
    lines.push(
      `Wearing ${list} as an UNBUTTONED, OPEN outer layer — the jacket/coat must hang open at the front so the inner top and bottoms underneath are clearly visible. Do NOT zip, button, or close the outerwear.`,
    );
  }
  if (byZone.dress.length) {
    const list = byZone.dress.map(describe).join(" and ");
    lines.push(`Wearing ${list} as a one-piece garment covering torso and lower body.`);
  }
  if (byZone.top.length) {
    const list = byZone.top.map(describe).join(" and ");
    lines.push(`Wearing ${list} on the upper body, fully visible from collar to hem.`);
  }
  if (byZone.bottom.length) {
    const list = byZone.bottom.map(describe).join(" and ");
    lines.push(`Wearing ${list} on the lower body, fully visible from waist to ankle.`);
  }
  if (byZone.shoe.length) {
    const list = byZone.shoe.map(describe).join(" and ");
    lines.push(`Wearing ${list} on the feet.`);
  }
  if (byZone.accessory.length) {
    const list = byZone.accessory.map(describe).join(" and ");
    lines.push(`Accessorised with ${list}.`);
  }
  if (byZone.other.length) {
    const list = byZone.other.map(describe).join(" and ");
    lines.push(`Also wearing ${list}.`);
  }

  const outfitDescription = lines.join(" ");
  const setting = occasion ? `${occasion} setting` : "neutral high-end studio";
  const fit = bodyShape ? `Tailored for a ${bodyShape.toLowerCase()} body shape. ` : "";
  const weatherNote = weather ? `Weather context: ${weather}. ` : "";
  const lookNote = desiredLook ? `Style direction: ${desiredLook}. ` : "";
  const extra = stylingInstruction ? `${stylingInstruction}. ` : "";

  return [
    "A high-fashion, photorealistic FULL-BODY WIDE SHOT of the same person from the reference selfie.",
    "OUTFIT RULES:",
    outfitDescription,
    "CRITICAL CONSTRAINTS:",
    "- ALL listed garments MUST be distinctly visible in the final image.",
    "- Frame the model from HEAD TO FEET. Do NOT crop the legs, do not crop above the knees, do not zoom in on the torso.",
    "- Preserve the EXACT facial identity, skin tone, hair color, and hairstyle from the reference selfie. Do not alter the face.",
    "- Natural standing pose, arms relaxed at sides so the entire outfit is unobstructed.",
    `- ${fit}${weatherNote}${lookNote}${extra}`,
    `Setting: ${setting}, soft natural lighting, editorial fashion photography, sharp detail on garment textures, 3:4 vertical aspect ratio.`,
  ].join(" ");
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${url} (${r.status})`);
  const buf = await r.arrayBuffer();
  const ct = r.headers.get("content-type") || "image/jpeg";
  // Base64 encode in chunks to avoid call-stack overflow on large buffers
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${ct};base64,${btoa(binary)}`;
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
      garments: garmentsInput,
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

    // Pre-flight HEAD check
    const urlsToCheck = [selfieUrl, ...garmentUrls];
    const headChecks = await Promise.all(
      urlsToCheck.map(async (u) => {
        try {
          const r = await fetch(u, { method: "HEAD" });
          return { url: u, ok: r.ok, status: r.status };
        } catch {
          return { url: u, ok: false, status: 0 };
        }
      }),
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

    // Build cache key from generation-affecting inputs
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
      promptVersion: "v2-bodyzone",
    };

    const inputHash = await computeInputHash(hashParts);

    // Cache check
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

    // ─── Build garment metadata ───────────────────────────────────────
    // If client didn't send rich metadata, synthesise minimal entries from the URLs.
    const garments: Garment[] = Array.isArray(garmentsInput) && garmentsInput.length
      ? garmentsInput
      : garmentUrls.map((url: string, i: number) => ({
          id: garmentIds[i] ?? String(i),
          url,
          category: null,
          name: null,
          brand: null,
        }));

    const prompt = buildOutfitPrompt({
      garments,
      occasion: occasion ?? null,
      desiredLook: desiredLook ?? null,
      weather: weather ?? null,
      bodyShape,
      stylingInstruction: stylingInstruction ?? null,
    });

    console.log("VTON prompt:", prompt);

    // ─── Lovable AI: Nano Banana Pro image generation ────────────────
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Convert all reference images to data URLs (gateway accepts both data: and https:)
    const [selfieDataUrl, ...garmentDataUrls] = await Promise.all([
      fetchAsDataUrl(selfieUrl),
      ...garments.map((g) => fetchAsDataUrl(g.url)),
    ]);

    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: prompt },
      {
        type: "text",
        text: "Reference 1 — the model's face/identity (use this person's exact face, hair, skin tone):",
      },
      { type: "image_url", image_url: { url: selfieDataUrl } },
    ];

    garmentDataUrls.forEach((dataUrl, i) => {
      const g = garments[i];
      userContent.push({
        type: "text",
        text: `Reference ${i + 2} — garment to place on the model: ${describe(g)}${
          g.category ? ` (${g.category})` : ""
        }. This exact item must appear in the output.`,
      });
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to your Lovable workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl: string | undefined =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl?.startsWith("data:image")) {
      console.error("AI response missing image:", JSON.stringify(aiData).slice(0, 500));
      throw new Error("AI did not return a valid image.");
    }

    // Decode base64 → bytes
    const [, base64] = imageDataUrl.split(",");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Upload to storage
    const filePath = `${userId}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("looks")
      .upload(filePath, bytes, { contentType: "image/png" });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error("Failed to save generated image");
    }

    // Cache
    await supabaseAdmin
      .from("generated_looks_cache")
      .insert({ input_hash: inputHash, image_path: filePath });

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("looks")
      .createSignedUrl(filePath, 3600);

    return new Response(
      JSON.stringify({
        image: signedUrlData?.signedUrl,
        image_path: filePath,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("virtual-tryon error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
