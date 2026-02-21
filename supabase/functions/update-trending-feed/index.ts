import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch from SerpApi Google Shopping
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: "trending clothing",
      gl: "uk",
      hl: "en",
      currency: "GBP",
      api_key: SERPAPI_KEY,
      num: "48",
    });

    console.log("Fetching trending clothes from SerpApi...");
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SerpApi error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const results = data.shopping_results || [];

    const items = results.slice(0, 48).map((item: any) => ({
      title: item.title || "Unknown",
      brand: item.source || null,
      price: item.extracted_price ? `£${item.extracted_price.toFixed(2)}` : item.price || "",
      image_url: item.thumbnail || "",
      product_link: item.link || "",
      category: "Trending",
    }));

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
