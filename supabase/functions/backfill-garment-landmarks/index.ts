import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import UPNG from "https://esm.sh/upng-js@2.1.0";

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

const hasImageAnalysis = (analysis: any) => Boolean(
  Number(analysis?.imageWidth) > 0 &&
  Number(analysis?.imageHeight) > 0 &&
  Number(analysis?.visibleWidth) > 0 &&
  Number(analysis?.visibleHeight) > 0 &&
  Number(analysis?.visibleWidthRatio) > 0 &&
  Number(analysis?.visibleHeightRatio) > 0
);

const cleanJson = (content: string) => content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

const calculateVisibleAlphaBounds = (bytes: Uint8Array) => {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const decoded = UPNG.decode(buffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
  const width = decoded.width;
  const height = decoded.height;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const alphaProfileRows = Array.from({ length: height }, () => 0);
  const alphaProfileColumns = Array.from({ length: width }, () => 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        alphaProfileRows[y] += 1;
        alphaProfileColumns[x] += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      imageWidth: width,
      imageHeight: height,
      visibleX: 0,
      visibleY: 0,
      visibleWidth: width,
      visibleHeight: height,
      visibleWidthRatio: 1,
      visibleHeightRatio: 1,
      visibleAlphaBounds: { x: 0, y: 0, width, height },
      alphaProfileRows,
      alphaProfileColumns,
      centerline: { x: width / 2, y: height / 2 },
      visibleExtents: { top: 0, bottom: height - 1, left: 0, right: width - 1 },
    };
  }

  const visibleWidth = maxX - minX + 1;
  const visibleHeight = maxY - minY + 1;
  return {
    imageWidth: width,
    imageHeight: height,
    visibleX: minX,
    visibleY: minY,
    visibleWidth,
    visibleHeight,
    visibleWidthRatio: visibleWidth / width,
    visibleHeightRatio: visibleHeight / height,
    visibleAlphaBounds: { x: minX, y: minY, width: visibleWidth, height: visibleHeight },
    alphaProfileRows,
    alphaProfileColumns,
    centerline: { x: minX + visibleWidth / 2, y: minY + visibleHeight / 2 },
    visibleExtents: { top: minY, bottom: maxY, left: minX, right: maxX },
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizePoint = (point: any, analysis: any) => {
  const x = Number(Array.isArray(point) ? point[0] : point?.x);
  const y = Number(Array.isArray(point) ? point[1] : point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x <= 1 ? x * analysis.imageWidth : x, 0, analysis.imageWidth),
    y: clamp(y <= 1 ? y * analysis.imageHeight : y, 0, analysis.imageHeight),
  };
};

const normalizeUpperAnchors = (layout: any, analysis: any, item: any) => {
  const rawAiLandmarks = { ...layout };
  const next = { ...layout, rawAiLandmarks };
  const confidenceBefore = Number(layout.confidence);
  const originalConfidence = Number.isFinite(confidenceBefore) ? clamp(confidenceBefore, 0, 1) : null;
  const typeText = `${layout.garmentType ?? ""} ${item.category ?? ""} ${item.name ?? ""}`.toLowerCase();
  const isDress = /\bdress|gown|jumpsuit|romper|one[-\s]?piece\b/.test(typeText);
  const isOuterwear = /\bouterwear|coat|jacket|blazer|trench|parka|cardigan\b/.test(typeText);
  const isTop = isDress || isOuterwear || /\btop|shirt|blouse|tee|knit|sweater|hoodie\b/.test(typeText);
  const minRatio = isOuterwear ? 0.44 : isDress ? 0.44 : 0.32;
  const maxRatio = isOuterwear ? 0.72 : isDress ? 0.64 : 0.62;
  const measurementMinRatio = isOuterwear ? 0.34 : isDress ? 0.3 : 0.25;
  const measurementMaxRatio = isOuterwear ? 0.78 : isDress ? 0.72 : 0.68;

  const left = normalizePoint(layout.leftUpperFitAnchor || layout.leftUpperAnchor, analysis);
  const right = normalizePoint(layout.rightUpperFitAnchor || layout.rightUpperAnchor, analysis);
  const rawWidth = Number(layout.upperBodyFitWidth || layout.upperBodyWidthAnchor) > 0
    ? Number(layout.upperBodyFitWidth || layout.upperBodyWidthAnchor)
    : left && right
      ? Math.abs(right.x - left.x)
      : 0;
  const rawRatio = rawWidth / analysis.imageWidth;

  if (isDress) {
    next.garmentType = "dress";
    next.bodyCoverage = next.bodyCoverage || "full_body";
    next.lengthClass = next.lengthClass || "midi";
  }

  const leftWaist = normalizePoint(layout.leftWaistAnchor, analysis);
  const rightWaist = normalizePoint(layout.rightWaistAnchor, analysis);
  if (leftWaist && rightWaist && (originalConfidence ?? 0) >= 0.5) {
    next.measurementAnchors = {
      ...(next.measurementAnchors || {}),
      waist: {
        leftWaistAnchor: leftWaist,
        rightWaistAnchor: rightWaist,
        waistWidth: Math.abs(rightWaist.x - leftWaist.x),
        confidence: originalConfidence,
        source: "ai",
        notes: layout.notes || "AI waist fit span.",
      },
    };
  }

  if (!isTop) return next;

  if (left && right && rawRatio >= measurementMinRatio && rawRatio <= measurementMaxRatio && (originalConfidence ?? 0) >= 0.5) {
    next.layoutAnchors = null;
    next.measurementAnchors = {
      ...(next.measurementAnchors || {}),
      upperFit: {
        leftUpperFitAnchor: left,
        rightUpperFitAnchor: right,
        upperBodyFitWidth: rawWidth,
        confidence: originalConfidence,
        source: "ai",
        notes: layout.notes || "AI measured upper-body fit width.",
      },
    };
    next.leftUpperAnchor = left;
    next.rightUpperAnchor = right;
    next.upperBodyWidthAnchor = rawWidth;
    next.anchorNormalization = "ai_upper_fit_within_ratio_guard";
    next.anchorSources = { leftUpperAnchor: "ai", rightUpperAnchor: "ai", upperBodyWidthAnchor: "ai" };
    next.confidenceBeforeNormalization = originalConfidence;
    next.confidenceAfterNormalization = originalConfidence;
    return next;
  }

  const centerX = left && right ? (left.x + right.x) / 2 : analysis.visibleX + analysis.visibleWidth / 2;
  const y = left && right ? (left.y + right.y) / 2 : analysis.visibleY + analysis.visibleHeight * (isOuterwear ? 0.16 : 0.12);
  const targetWidth = clamp(
    Math.max(rawWidth, analysis.imageWidth * minRatio),
    analysis.imageWidth * minRatio,
    Math.min(analysis.visibleWidth, analysis.imageWidth * maxRatio),
  );
  const half = targetWidth / 2;
  const layoutLeft = { x: clamp(centerX - half, 0, analysis.imageWidth), y: clamp(y, 0, analysis.imageHeight) };
  const layoutRight = { x: clamp(centerX + half, 0, analysis.imageWidth), y: clamp(y, 0, analysis.imageHeight) };
  const source = rawWidth > 0 ? "ratio_guard" : "alpha_estimate";
  const reason = rawWidth > 0 ? "estimated_layout_scaling_ratio_guard_implausibly_narrow_ai_upper_fit" : "estimated_layout_scaling_from_alpha_bounds";
  next.measurementAnchors = null;
  next.layoutAnchors = {
    upperFit: {
      leftUpperFitAnchor: layoutLeft,
      rightUpperFitAnchor: layoutRight,
      upperBodyFitWidth: Math.abs(layoutRight.x - layoutLeft.x),
      confidence: source === "ratio_guard" ? 0.49 : 0.35,
      source,
      normalizationReason: reason,
      notes: source === "ratio_guard"
        ? "Estimated layout scaling expanded from an implausibly narrow AI upper-fit span; not a measured shoulder/fit line."
        : "Estimated layout scaling from visible alpha bounds; not a measured shoulder/fit line.",
    },
  };
  next.leftUpperAnchor = layoutLeft;
  next.rightUpperAnchor = layoutRight;
  next.upperBodyWidthAnchor = next.layoutAnchors.upperFit.upperBodyFitWidth;
  next.anchorNormalization = reason;
  next.anchorSources = { leftUpperAnchor: source, rightUpperAnchor: source, upperBodyWidthAnchor: source };
  next.confidenceBeforeNormalization = originalConfidence;
  next.confidence = next.layoutAnchors.upperFit.confidence;
  next.confidenceAfterNormalization = next.confidence;
  return next;
};

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
    const limit = Math.max(1, Math.min(Number(body.limit) || 20, 300));
    const targetIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id: unknown) => typeof id === "string") : [];
    const force = Boolean(body.force);

    let query = admin
      .from("closet_items")
      .select("id, name, category, image_url, image_analysis, layout_metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (targetIds.length > 0) query = query.in("id", targetIds);
    const { data: rows, error: selectError } = await query;
    if (selectError) throw selectError;

    const candidates = (rows || []).filter((item: any) => force || !hasUpperAnchors(item.layout_metadata) || !hasImageAnalysis(item.image_analysis)).slice(0, limit);
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

        const imageAnalysis = calculateVisibleAlphaBounds(imageBytes);
        const prompt = `Analyze this already background-removed garment PNG for outfit preview scaling. Return ONLY a JSON object named layout_metadata with these fields: garmentType, bodyCoverage, lengthClass, bulkClass, preferredPreviewScale, leftUpperFitAnchor and rightUpperFitAnchor as PIXEL coordinates, upperBodyFitWidth as the pixel distance between them, necklineCenter if visible, waistCenter if visible, hemCenter if visible, confidence from 0 to 1, and notes explaining exactly what was measured. For dresses, especially asymmetric or sleeveless dresses, do NOT measure literal shoulder seams. Detect upperBodyFitWidth: the visual width across the upper bodice/chest/armhole area that corresponds to the wearer's upper torso. For coats/tops, use the visible upper-body fit span, not transparent canvas edges. If confidence is low, the span is ambiguous, or the span is implausibly narrow for the garment, return the best estimate but set confidence below 0.5 and explain why in notes. Canvas size is ${imageAnalysis.imageWidth}x${imageAnalysis.imageHeight}. Visible alpha bounds are ${JSON.stringify(imageAnalysis.visibleAlphaBounds)}. Item context: category=${item.category ?? "unknown"}, name=${item.name ?? "unknown"}. If the item name says dress, garmentType must be dress and bodyCoverage should usually be full_body.`;

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
        const rawLayout = parsed.layout_metadata || parsed;
        const layout = normalizeUpperAnchors(rawLayout, imageAnalysis, item);
        const nextMetadata = {
          ...(item.layout_metadata || {}),
          ...layout,
          rawAiLandmarks: rawLayout,
          rawAiLayoutMetadata: rawLayout,
          visibleAlphaBounds: imageAnalysis.visibleAlphaBounds,
        };

        const canonicalCategory = String(nextMetadata.garmentType || "").toLowerCase() === "dress" || /\bdress\b/i.test(item.name || "")
          ? "Dresses"
          : item.category;

        const { error: updateError } = await admin
          .from("closet_items")
          .update({ image_analysis: imageAnalysis, layout_metadata: nextMetadata, category: canonicalCategory })
          .eq("id", item.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
        results.push({
          id: item.id,
          status: "updated",
          category: canonicalCategory,
          rawAiLayoutMetadata: rawLayout,
          normalizedMetadata: nextMetadata,
          anchorNormalization: nextMetadata.anchorNormalization ?? null,
          anchorSources: nextMetadata.anchorSources ?? null,
          confidenceBeforeNormalization: nextMetadata.confidenceBeforeNormalization ?? rawLayout?.confidence ?? null,
          confidenceAfterNormalization: nextMetadata.confidence ?? null,
        });
      } catch (error) {
        console.error("Landmark backfill item failed", item.id, error);
        results.push({ id: item.id, status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    return json({ scanned: rows?.length || 0, missing: (rows || []).filter((item: any) => !hasUpperAnchors(item.layout_metadata) || !hasImageAnalysis(item.image_analysis)).length, processed: candidates.length, results });
  } catch (error) {
    console.error("backfill-garment-landmarks error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});