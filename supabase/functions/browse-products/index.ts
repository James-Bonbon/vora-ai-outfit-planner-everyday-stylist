import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_CATEGORIES = [
  "Skincare", "Perfume", "Foundation", "Lipstick",
  "Mascara", "Eyeshadow", "Blush", "Bronzer",
  "Eyeliner", "Nail Polish", "Other",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: require authenticated user ──────────────────────
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { category, search } = await req.json();
    const searchQuery = (search || "beauty makeup skincare perfume").trim().toLowerCase();

    // 1. Cache-first: check if we already have results for this query
    const { data: cached } = await sb
      .from("beauty_products_catalog")
      .select("*")
      .eq("search_query", searchQuery);

    if (cached && cached.length > 0) {
      console.log(`Cache hit for query: ${cached.length} products`);
      return new Response(JSON.stringify({ products: cached }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Cache miss — fetch from SerpApi
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");

    const baseQuery = search || category || "beauty products";
    const query = `${baseQuery} beauty skincare`;

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      gl: "uk",
      hl: "en",
      currency: "GBP",
      api_key: SERPAPI_KEY,
      num: "40",
    });

    console.log("SerpApi cache miss — fetching");
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SerpApi error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const results = data.shopping_results || [];

    // Filter out non-beauty
    const EXCLUDED = ["boots", "shoes", "heels", "leather", "trainers", "sneakers", "sandals", "loafers"];
    const filtered = results.filter((item: any) => {
      const title = (item.title || "").toLowerCase();
      return !EXCLUDED.some((kw) => title.includes(kw));
    });

    const rawProducts = filtered.slice(0, 30).map((item: any) => ({
      name: item.title || "Unknown Product",
      brand: item.source || "",
      description: item.snippet || "",
      image_url: item.high_res_image || item.thumbnail || "",
      price: item.extracted_price ? `£${item.extracted_price.toFixed(2)}` : item.price || "",
      rating: item.rating ? parseFloat(item.rating) : null,
      reviews: item.reviews || 0,
      store: item.source || "",
      product_link: item.link || "",
    }));

    // 3. AI classification in batch
    let categories: string[] = rawProducts.map(() => "Other");

    if (LOVABLE_API_KEY && rawProducts.length > 0) {
      try {
        const productList = rawProducts
          .map((p: any, i: number) => `${i}. "${p.name}" by ${p.brand}. ${p.description}`)
          .join("\n");

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
                content: `You are a beauty product categorizer. For each numbered product, classify it into exactly ONE of these categories: ${VALID_CATEGORIES.join(", ")}. Respond ONLY with a JSON array of strings matching each product index. Example: ["Skincare","Lipstick","Other"]`,
              },
              { role: "user", content: productList },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData.choices?.[0]?.message?.content || "";
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length === rawProducts.length) {
              categories = parsed.map((c: string) =>
                VALID_CATEGORIES.includes(c) ? c : "Other"
              );
            }
          }
        } else {
          console.error("AI classification failed:", aiResp.status);
        }
      } catch (e) {
        console.error("AI classification error:", e);
      }
    }

    // 4. Insert into catalog
    const catalogRows = rawProducts.map((p: any, i: number) => ({
      ...p,
      standardized_category: categories[i],
      search_query: searchQuery,
    }));

    const { data: inserted, error: insertErr } = await sb
      .from("beauty_products_catalog")
      .insert(catalogRows)
      .select();

    if (insertErr) {
      console.error("Catalog insert error:", insertErr);
      // Still return results even if caching fails
      const fallback = catalogRows.map((r: any, i: number) => ({ id: i, ...r }));
      return new Response(JSON.stringify({ products: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Cached ${inserted.length} products`);
    return new Response(JSON.stringify({ products: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("browse-products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
