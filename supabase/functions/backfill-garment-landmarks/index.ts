import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const uint8ToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const hasUpperAnchors = (metadata: any) => Boolean(
  metadata?.leftUpperAnchor && metadata?.rightUpperAnchor && Number(metadata?.upperBodyWidthAnchor) > 0,
);

const cleanJson = (content: string) => content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit) || 20, 50));

    const { data: rows, error: selectError } = await admin
      .from("closet_items")
      .select("id, name, category, image_url, image_analysis, layout_metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (selectError) throw selectError;

    const candidates = (rows || []).filter((item: any) => !hasUpperAnchors(item.layout_metadata)).slice(0, limit);
    const results: any[] = [];

    for (const item of candidates) {
      try {
        let imageBytes: Uint8Array;
        if (String(item.image_url).startsWith("http")) {
          const imageRes = await fetch(item.image_url);
          if (!imageRes.ok) throw new Error(`Image fetch failed: ${imageRes.status}`);
          imageBytes = new Uint8Array(await imageRes.arrayBuffer());
        } else {
          const { data: fileData, error: downloadError } = await admin.storage.from("garments").download(item.image_url);
          if (downloadError || !fileData) throw downloadError || new Error("Image download failed");
          imageBytes = new Uint8Array(await fileData.arrayBuffer());
        }

        const prompt = `Analyze this already background-removed garment PNG for outfit preview scaling. Return ONLY a JSON object named layout_metadata with these fields: garmentType, bodyCoverage, lengthClass, visibleAlphaBounds as pixel coordinates if visible, leftUpperAnchor and rightUpperAnchor as PIXEL coordinates on the actual visible upper-body span (shoulder seam, strap, upper bodice, or coat shoulder span; not transparent canvas edges), upperBodyWidthAnchor as the pixel distance between those anchors, necklineCenter if visible, waistCenter if visible, hemCenter if visible, confidence from 0 to 1. Use upper-body anchors rather than strict shoulders because garments can be sleeveless, strapless, one-shoulder, or asymmetric. Item context: category=${item.category ?? "unknown"}, name=${item.name ?? "unknown"}.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${uint8ToBase64(imageBytes)}` } },
            ] }],
            max_tokens: 650,
          }),
        });
        if (!aiRes.ok) throw new Error(`AI error ${aiRes.status}: ${await aiRes.text()}`);

        const aiData = await aiRes.json();
        const parsed = JSON.parse(cleanJson(aiData.choices?.[0]?.message?.content || "{}"));
        const layout = parsed.layout_metadata || parsed;
        const nextMetadata = {
          ...(item.layout_metadata || {}),
          ...layout,
          visibleAlphaBounds: layout.visibleAlphaBounds || item.image_analysis?.visibleAlphaBounds,
        };

        const { error: updateError } = await admin
          .from("closet_items")
          .update({ layout_metadata: nextMetadata })
          .eq("id", item.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
        results.push({ id: item.id, status: "updated", confidence: nextMetadata.confidence ?? null });
      } catch (error) {
        console.error("Landmark backfill item failed", item.id, error);
        results.push({ id: item.id, status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    return json({ scanned: rows?.length || 0, missing: (rows || []).filter((item: any) => !hasUpperAnchors(item.layout_metadata)).length, processed: candidates.length, results });
  } catch (error) {
    console.error("backfill-garment-landmarks error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});