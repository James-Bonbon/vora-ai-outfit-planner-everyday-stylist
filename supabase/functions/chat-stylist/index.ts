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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step A: Fetch user's wardrobe (lightweight columns only)
    const { data: wardrobe } = await supabase
      .from("closet_items")
      .select("id, name, category, color, material, brand")
      .eq("user_id", userId);

    // Step B: Fetch user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("body_shape, sex")
      .eq("user_id", userId)
      .single();

    const wardrobeJson = JSON.stringify(wardrobe || []);

    const systemPrompt = `You are Vora, a warm, knowledgeable personal stylist AI. You have access to the user's complete digital wardrobe.

USER'S WARDROBE (JSON):
${wardrobeJson}

USER PROFILE:
- Body shape: ${profile?.body_shape || "unknown"}
- Sex: ${profile?.sex || "not specified"}

RULES:
1. When recommending outfits, ONLY suggest garments from the wardrobe above using their exact IDs.
2. Be conversational, warm, and fashion-forward. Use concise language.
3. When asked about outfits, always suggest specific items and explain WHY they work together (color theory, occasion, body shape, etc).
4. If the wardrobe doesn't have suitable items, say so honestly and suggest what they might want to add.
5. You MUST respond using the suggest_outfit tool when recommending specific garments. Use it even for single-item recommendations.
6. For general fashion advice with no specific garment recommendations, respond normally without the tool.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step C: Call LLM with tool calling for structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_outfit",
              description:
                "Recommend specific garments from the user's wardrobe. Use this whenever you mention specific clothing items.",
              parameters: {
                type: "object",
                properties: {
                  reply_text: {
                    type: "string",
                    description: "Your conversational styling advice explaining why these items work.",
                  },
                  recommended_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of garment UUIDs from the user's wardrobe.",
                  },
                },
                required: ["reply_text", "recommended_ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const choice = aiResult.choices?.[0];

    let replyText = "";
    let recommendedIds: string[] = [];

    if (choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      replyText = args.reply_text || "";
      recommendedIds = args.recommended_ids || [];
    } else {
      replyText = choice?.message?.content || "I'm not sure how to help with that. Try asking me about outfit ideas!";
    }

    // Persist assistant message
    await supabase.from("chat_messages").insert({
      user_id: userId,
      role: "assistant",
      content: replyText,
      suggested_garment_ids: recommendedIds.length > 0 ? recommendedIds : null,
    });

    return new Response(
      JSON.stringify({
        reply_text: replyText,
        recommended_ids: recommendedIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat-stylist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
