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
    const { postId, imageUrl } = await req.json();
    if (!postId || !imageUrl) {
      return new Response(JSON.stringify({ error: "postId and imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Ask AI to moderate the image
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
      console.error("AI moderation error:", aiResp.status, errText);

      if (aiResp.status === 429 || aiResp.status === 402) {
        // On rate limit or credits issue, auto-approve to not block the user
        await supabaseAdmin.from("feed_posts").update({ status: "approved" }).eq("id", postId);
        return new Response(JSON.stringify({ status: "approved", reason: "auto-approved (rate limit)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const verdict = (aiData.choices?.[0]?.message?.content || "").trim().toUpperCase();
    const newStatus = verdict.includes("APPROVED") ? "approved" : "rejected";

    await supabaseAdmin.from("feed_posts").update({ status: newStatus }).eq("id", postId);

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
