import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: verify JWT ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const { postId, imageUrl } = await req.json();
    if (!postId || !imageUrl) {
      return new Response(JSON.stringify({ error: "postId and imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Ownership / role check ────────────────────────────────
    const { data: postRow } = await supabaseAdmin
      .from("feed_posts")
      .select("user_id, is_vton, outfit_breakdown, status")
      .eq("id", postId)
      .maybeSingle();

    if (!postRow) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller owns the post OR is admin/moderator
    const isOwner = postRow.user_id === callerId;
    let isPrivileged = false;
    if (!isOwner) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .in("role", ["admin", "moderator"])
        .maybeSingle();
      isPrivileged = !!roleRow;
    }

    if (!isOwner && !isPrivileged) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only moderate posts that are still pending
    if (postRow.status !== "pending") {
      return new Response(JSON.stringify({ status: postRow.status, reason: "already moderated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const needsBreakdown =
      !postRow.is_vton &&
      (!postRow.outfit_breakdown || (Array.isArray(postRow.outfit_breakdown) && postRow.outfit_breakdown.length === 0));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Moderate the image
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a content moderation AI for a fashion app. Analyze the image and respond with ONLY one word: APPROVED or REJECTED. Reject if the image contains: NSFW content, nudity, extreme violence, hate symbols, spam, or content that is clearly not fashion/outfit related (e.g. landscapes, food, memes). Approve if it shows a person wearing clothes, outfit flat-lays, fashion items, or style-related content.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: "Is this image appropriate for a fashion community feed? Reply APPROVED or REJECTED only.",
              },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI moderation error:", aiResp.status);

      if (aiResp.status === 429 || aiResp.status === 402) {
        await supabaseAdmin.from("feed_posts").update({ status: "approved" }).eq("id", postId);
        return new Response(JSON.stringify({ status: "approved", reason: "auto-approved (rate limit)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const verdict = (aiData.choices?.[0]?.message?.content || "").trim().toUpperCase();
    // Only allow approved/rejected — no arbitrary status mutation
    const newStatus = verdict.includes("APPROVED") ? "approved" : "rejected";

    const updatePayload: Record<string, unknown> = { status: newStatus };

    // Step 2: Auto-breakdown for direct uploads (non-VTON, approved, empty breakdown)
    if (needsBreakdown && newStatus === "approved") {
      try {
        const breakdownResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You are a fashion garment analyzer. Analyze the outfit in the image. Return ONLY a valid JSON array of garments worn (Tops, Bottoms, Shoes). EXCLUDE all accessories, jewelry, bags, or hats. For each garment, provide: name (string), category (one of: TOP, BOT, SHOE, OUT), color (string). Set image_url to null. Example: [{\"name\":\"White Linen Shirt\",\"category\":\"TOP\",\"color\":\"white\",\"image_url\":null}]",
              },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: imageUrl } },
                  { type: "text", text: "Analyze this outfit. Return the JSON array only, no markdown." },
                ],
              },
            ],
          }),
        });

        if (breakdownResp.ok) {
          const breakdownData = await breakdownResp.json();
          const rawText = (breakdownData.choices?.[0]?.message?.content || "").trim();
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const garments = JSON.parse(jsonMatch[0]);
            if (Array.isArray(garments) && garments.length > 0) {
              updatePayload.outfit_breakdown = garments.map((g: any, i: number) => ({
                id: `auto-${postId.slice(0, 8)}-${i}`,
                name: g.name || "Unknown",
                category: g.category || "TOP",
                color: g.color || "",
                brand: g.brand || "",
                flat_lay_image_url: g.image_url || null,
              }));
            }
          }
        }
      } catch (breakdownErr) {
        console.error("Auto-breakdown error (non-fatal):", breakdownErr);
      }
    }

    await supabaseAdmin.from("feed_posts").update(updatePayload).eq("id", postId);

    return new Response(JSON.stringify({ status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-feed-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
