import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");

    const { category, search } = await req.json();

    const query = search || category || "beauty products";

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      gl: "uk",
      hl: "en",
      currency: "GBP",
      api_key: SERPAPI_KEY,
      num: "30",
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    console.log("SerpApi query:", query);

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SerpApi error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const results = data.shopping_results || [];

    const products = results.map((item: any, idx: number) => ({
      id: idx,
      name: item.title || "Unknown Product",
      brand: item.source || "",
      product_type: category || "",
      rating: item.rating ? parseFloat(item.rating) : null,
      reviews: item.reviews || 0,
      description: item.snippet || "",
      image_url: item.thumbnail || "",
      price: item.extracted_price ? `£${item.extracted_price.toFixed(2)}` : item.price || "",
      store: item.source || "",
      product_link: item.link || "",
      tag_list: [],
      product_colors: [],
    }));

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("browse-products error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
