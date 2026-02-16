import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAKEUP_API = "http://makeup-api.herokuapp.com/api/v1/products.json";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { category, search } = await req.json();

    // Build query params for Makeup API
    const params = new URLSearchParams();

    // Map categories to Makeup API product_type values
    const categoryMap: Record<string, string> = {
      "All Skincare": "",
      "Cleanser": "",
      "Moisturiser": "",
      "Foundation": "foundation",
      "Lipstick": "lipstick",
      "Mascara": "mascara",
      "Eyeshadow": "eyeshadow",
      "Blush": "blush",
      "Bronzer": "bronzer",
      "Eyeliner": "eyeliner",
      "Nail Polish": "nail_polish",
      "Lip Liner": "lip_liner",
    };

    const mappedType = categoryMap[category] ?? category?.toLowerCase().replace(/\s+/g, "_") ?? "";
    if (mappedType) {
      params.set("product_type", mappedType);
    }

    // Use brand search if search query looks like a brand
    if (search) {
      params.set("brand", search.toLowerCase().replace(/\s+/g, "_"));
    }

    const url = `${MAKEUP_API}?${params.toString()}`;
    console.log("Fetching:", url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Makeup API error: ${response.status}`);
    }

    const rawProducts = await response.json();

    // Filter products with images and meaningful data
    const filtered = rawProducts
      .filter((p: any) => p.image_link && p.name && p.brand)
      .slice(0, 30); // Return up to 30 products

    // Map to our format
    const products = filtered.map((p: any) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      product_type: (p.product_type || "").replace(/_/g, " "),
      rating: p.rating ? parseFloat(p.rating) : null,
      description: p.description || "",
      image_url: ((p.api_featured_image || p.image_link || "") as string).replace(/^\/\//, "https://"),
      tag_list: p.tag_list || [],
      product_colors: (p.product_colors || []).slice(0, 8).map((c: any) => ({
        name: c.colour_name,
        hex: c.hex_value,
      })),
      product_link: p.product_link || "",
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
