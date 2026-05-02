// Shared AI outfit scoring engine.
// Receives candidate outfits + context, calls Lovable AI Gateway (openai/gpt-5-mini)
// using tool-calling for structured output, caches results in outfit_score_cache.
//
// Billing: uses LOVABLE_API_KEY -> Lovable Cloud & AI balance.
// Auth: validates Supabase JWT in code (verify_jwt = false in config).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ────────────────────────────────────────────────────────────────
interface Item {
  id: string;
  name?: string | null;
  category?: string | null;
  color?: string | null;
  material?: string | null;
  brand?: string | null;
  image_url?: string | null;
}
interface Candidate {
  signature: string;          // stable id e.g. sorted garment ids joined
  items: Item[];
}
interface Context {
  date: string;               // yyyy-MM-dd
  tempC?: number | null;
  weatherCode?: number | null;
  occasion?: string | null;
  history?: { date: string; garmentIds: string[] }[];
  userPrefs?: Record<string, unknown> | null;
  prefsVersion?: string | null;
}
interface ScoreResult {
  signature: string;
  cacheKey: string;
  score: number;
  decision: "accept" | "fallback" | "reject";
  confidence: number;
  reasons: string[];
  warnings: string[];
  colorHarmony: number;
  silhouetteBalance: number;
  occasionMatch: number;
  weatherSuitability: number;
  repeatPenalty: number;
  stylingNotes: string;
  cached: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tempBucket(t?: number | null): string {
  if (t == null || !Number.isFinite(t)) return "u";
  return String(Math.round(t / 5) * 5);
}

async function buildCacheKey(c: Candidate, ctx: Context): Promise<string> {
  const ids = [...c.items.map((i) => i.id)].sort().join("|");
  const raw = [
    ids,
    tempBucket(ctx.tempC),
    (ctx.occasion || "").toLowerCase(),
    ctx.date,
    ctx.prefsVersion || "v1",
  ].join("::");
  return sha256Hex(raw);
}

function decisionFromScore(score: number): "accept" | "fallback" | "reject" {
  if (score >= 70) return "accept";
  if (score >= 55) return "fallback";
  return "reject";
}

// ── Tool schema for structured output ────────────────────────────────────
const scoreToolSchema = {
  type: "function" as const,
  function: {
    name: "rate_outfits",
    description: "Score a batch of candidate outfits with detailed sub-scores.",
    parameters: {
      type: "object",
      properties: {
        outfits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              signature: { type: "string", description: "Echo back the candidate's signature." },
              score: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reasons: { type: "array", items: { type: "string" }, description: "Top 2-3 reasons it works" },
              warnings: { type: "array", items: { type: "string" }, description: "Issues, e.g. missing shoes" },
              colorHarmony: { type: "number", minimum: 0, maximum: 1 },
              silhouetteBalance: { type: "number", minimum: 0, maximum: 1 },
              occasionMatch: { type: "number", minimum: 0, maximum: 1 },
              weatherSuitability: { type: "number", minimum: 0, maximum: 1 },
              repeatPenalty: { type: "number", minimum: 0, maximum: 1, description: "0 = fresh, 1 = heavily repeated" },
              stylingNotes: { type: "string" },
            },
            required: [
              "signature", "score", "confidence", "reasons", "warnings",
              "colorHarmony", "silhouetteBalance", "occasionMatch",
              "weatherSuitability", "repeatPenalty", "stylingNotes",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["outfits"],
      additionalProperties: false,
    },
  },
};

// ── AI call ──────────────────────────────────────────────────────────────
async function callAI(candidates: Candidate[], ctx: Context): Promise<Map<string, Omit<ScoreResult, "cacheKey" | "cached">>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `You are a senior fashion stylist scoring outfit candidates.
Score each outfit on:
- color harmony, silhouette balance, occasion suitability, weather suitability,
  season/material suitability, category compatibility, formality consistency,
  outfit completeness, freshness vs recent history, intentional styling.

Scoring bands:
- 85-100 = strong, looks intentional and considered
- 70-84  = acceptable, perfectly wearable
- 55-69  = weak, only use when wardrobe is sparse
- below 55 = reject

Be strict. Penalize obvious clashes, formality mismatches, weather mismatches, and obvious repeats.
Always echo each outfit's signature exactly so we can map your response back.`;

  const userPayload = {
    context: {
      date: ctx.date,
      tempC: ctx.tempC ?? null,
      weatherCode: ctx.weatherCode ?? null,
      occasion: ctx.occasion ?? null,
      recentHistory: (ctx.history || []).slice(-7),
      userPrefs: ctx.userPrefs ?? null,
    },
    candidates: candidates.map((c) => ({
      signature: c.signature,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name || null,
        category: i.category || null,
        color: i.color || null,
        material: i.material || null,
        brand: i.brand || null,
      })),
    })),
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      tools: [scoreToolSchema],
      tool_choice: { type: "function", function: { name: "rate_outfits" } },
    }),
  });

  if (!resp.ok) {
    const status = resp.status;
    const text = await resp.text().catch(() => "");
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI gateway error ${status}: ${text}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No tool call returned");

  const parsed = JSON.parse(toolCall.function.arguments);
  const out = new Map<string, Omit<ScoreResult, "cacheKey" | "cached">>();
  for (const o of parsed.outfits || []) {
    const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)));
    out.set(o.signature, {
      signature: o.signature,
      score,
      decision: decisionFromScore(score),
      confidence: Number(o.confidence) || 0,
      reasons: Array.isArray(o.reasons) ? o.reasons.slice(0, 4) : [],
      warnings: Array.isArray(o.warnings) ? o.warnings.slice(0, 4) : [],
      colorHarmony: Number(o.colorHarmony) || 0,
      silhouetteBalance: Number(o.silhouetteBalance) || 0,
      occasionMatch: Number(o.occasionMatch) || 0,
      weatherSuitability: Number(o.weatherSuitability) || 0,
      repeatPenalty: Number(o.repeatPenalty) || 0,
      stylingNotes: String(o.stylingNotes || ""),
    });
  }
  return out;
}

// ── Handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.candidates) || !body.context) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidates: Candidate[] = body.candidates.slice(0, 8); // cap batch
    const ctx: Context = body.context;

    // 1. Build cache keys
    const keyed = await Promise.all(candidates.map(async (c) => ({ c, key: await buildCacheKey(c, ctx) })));
    const allKeys = keyed.map((k) => k.key);

    // 2. Look up existing cache rows
    const { data: cachedRows } = await supabase
      .from("outfit_score_cache")
      .select("cache_key, score, decision, confidence, payload")
      .eq("user_id", userId)
      .in("cache_key", allKeys);
    const cacheMap = new Map<string, any>();
    for (const r of cachedRows || []) cacheMap.set(r.cache_key, r);

    // 3. Determine which need AI
    const needAI = keyed.filter((k) => !cacheMap.has(k.key));

    // 4. Call AI for cache misses
    let aiResults: Map<string, Omit<ScoreResult, "cacheKey" | "cached">> = new Map();
    if (needAI.length > 0) {
      try {
        aiResults = await callAI(needAI.map((k) => k.c), ctx);
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (msg === "PAYMENT_REQUIRED") {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("score-outfits AI error:", msg);
        // Continue with cached results only
      }
    }

    // 5. Persist new AI results
    const toInsert: any[] = [];
    for (const { c, key } of needAI) {
      const r = aiResults.get(c.signature);
      if (!r) continue;
      toInsert.push({
        user_id: userId,
        cache_key: key,
        garment_ids: c.items.map((i) => i.id),
        score: r.score,
        decision: r.decision,
        confidence: r.confidence,
        payload: r,
      });
    }
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("outfit_score_cache")
        .upsert(toInsert, { onConflict: "user_id,cache_key" });
      if (insErr) console.error("cache insert error:", insErr.message);
    }

    // 6. Build response
    const results: ScoreResult[] = keyed.map(({ c, key }) => {
      const cached = cacheMap.get(key);
      if (cached) {
        const p = cached.payload || {};
        return {
          signature: c.signature,
          cacheKey: key,
          score: cached.score,
          decision: (cached.decision || decisionFromScore(cached.score)) as ScoreResult["decision"],
          confidence: Number(cached.confidence) || 0,
          reasons: p.reasons || [],
          warnings: p.warnings || [],
          colorHarmony: p.colorHarmony || 0,
          silhouetteBalance: p.silhouetteBalance || 0,
          occasionMatch: p.occasionMatch || 0,
          weatherSuitability: p.weatherSuitability || 0,
          repeatPenalty: p.repeatPenalty || 0,
          stylingNotes: p.stylingNotes || "",
          cached: true,
        };
      }
      const fresh = aiResults.get(c.signature);
      if (fresh) return { ...fresh, cacheKey: key, cached: false };
      // No AI result available (e.g. AI failed): return null score so caller can fall back
      return {
        signature: c.signature,
        cacheKey: key,
        score: 0,
        decision: "reject",
        confidence: 0,
        reasons: [],
        warnings: ["ai_unavailable"],
        colorHarmony: 0,
        silhouetteBalance: 0,
        occasionMatch: 0,
        weatherSuitability: 0,
        repeatPenalty: 0,
        stylingNotes: "",
        cached: false,
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("score-outfits error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
