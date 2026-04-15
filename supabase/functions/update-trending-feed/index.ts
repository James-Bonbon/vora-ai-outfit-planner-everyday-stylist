import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QueryConfig {
  q: string;
  category: string;
}

const QUERIES: QueryConfig[] = [
  { q: "trending UK tops", category: "Tops" },
  { q: "trending UK trousers and skirts", category: "Bottoms" },
  { q: "trending UK jackets and coats", category: "Outerwear" },
  { q: "trending UK shoes", category: "Shoes" },
];

async function fetchCategory(apiKey: string, config: QueryConfig) {
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: config.q,
    gl: "uk",
    hl: "en",
    currency: "GBP",
    api_key: apiKey,
    num: "50",
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi error for "${config.q}": ${response.status} – ${text}`);
  }

  const data = await response.json();
  const results = data.shopping_results || [];

  return results.slice(0, 50).map((item: any) => ({
    title: item.title || "Unknown",
    brand: item.source || null,
    price: item.extracted_price ? `£${item.extracted_price.toFixed(2)}` : item.price || "",
    image_url: item.thumbnail || "",
    product_link: item.link || "",
    category: config.category,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: require admin role ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const userId = claimsData.claims.sub;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check admin role
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");

    console.log("Fetching 4 categories in parallel from SerpApi...");

    const allResults = await Promise.all(
      QUERIES.map((config) => fetchCategory(SERPAPI_KEY, config))
    );

    const items = allResults.flat();
    console.log(`Fetched ${items.length} total items across ${QUERIES.length} categories`);

    // Clear old data and insert fresh
    await sb.from("trending_clothes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: inserted, error: insertErr } = await sb
      .from("trending_clothes")
      .insert(items)
      .select();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error(insertErr.message);
    }

    console.log(`Cached ${inserted?.length || 0} trending items`);
    return new Response(JSON.stringify({ count: inserted?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("update-trending-feed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
