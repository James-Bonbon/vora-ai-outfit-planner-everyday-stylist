import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  "Skincare",
  "Perfume",
  "Foundation",
  "Lipstick",
  "Mascara",
  "Eyeliner",
  "Nail Polish",
  "Blush",
  "Bronzer",
  "Eyeshadow",
];

const EXCLUDED_KEYWORDS = [
  "boots", "shoes", "heels", "leather", "trainers",
  "sneakers", "sandals", "loafers",
];

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

    // Check admin role
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    let totalInserted = 0;
    const errors: string[] = [];

    for (const category of CATEGORIES) {
      try {
        console.log(`Fetching: ${category}`);
        const query = `${category} best rated beauty`;

        const params = new URLSearchParams({
          engine: "google_shopping",
          q: query,
          gl: "uk",
          hl: "en",
          currency: "GBP",
          api_key: SERPAPI_KEY,
          num: "40",
        });

        const response = await fetch(`https://serpapi.com/search.json?${params}`);
        if (!response.ok) {
          errors.push(`${category}: SerpApi ${response.status}`);
          continue;
        }

        const data = await response.json();
        const results = data.shopping_results || [];

        const filtered = results.filter((item: any) => {
          const title = (item.title || "").toLowerCase();
          return !EXCLUDED_KEYWORDS.some((kw) => title.includes(kw));
        });

        const rows = filtered.slice(0, 30).map((item: any) => ({
          name: item.title || "Unknown Product",
          brand: item.source || "",
          description: item.snippet || "",
          image_url: item.high_res_image || item.thumbnail || "",
          price: item.extracted_price ? `£${item.extracted_price.toFixed(2)}` : item.price || "",
          rating: item.rating ? parseFloat(item.rating) : null,
          reviews: item.reviews || 0,
          store: item.source || "",
          product_link: item.link || "",
          standardized_category: category,
          search_query: `${category.toLowerCase()} best rated`,
        }));

        if (rows.length > 0) {
          const { data: upserted, error: upsertErr } = await sb
            .from("beauty_products_catalog")
            .upsert(rows, { onConflict: "name" })
            .select("id");

          if (upsertErr) {
            errors.push(`${category}: ${upsertErr.message}`);
          } else {
            totalInserted += upserted?.length || 0;
            console.log(`${category}: upserted ${upserted?.length} products`);
          }
        }

        // Rate limit: 1s delay between categories
        await new Promise((r) => setTimeout(r, 1000));
      } catch (catErr: any) {
        errors.push(`${category}: ${catErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalInserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("seed-beauty-library error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
