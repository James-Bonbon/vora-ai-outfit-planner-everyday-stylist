import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const formData = await req.formData();
    const imageFile = formData.get("image_file");

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const apiKey = Deno.env.get("PHOTOROOM_API_KEY") ?? "";
    if (!apiKey) {
      throw new Error("PHOTOROOM_API_KEY is not configured");
    }

    // ==========================================
    // STEP 1: Generative AI (Remove Model & Reconstruct Flat-Lay)
    // ==========================================
    const editFormData = new FormData();
    editFormData.append("imageFile", imageFile);
    editFormData.append("describeAnyChange.mode", "ai.auto");
    editFormData.append(
      "describeAnyChange.prompt",
      "Create a Flat Lay of the subject. The background must be pure white. The photo should be taken from the top. Remove wrinkles make the subject look new, steam-press the garnment. Strictly preserve the exact original colors, patterns, and fabric textures."
    );

    console.log("Step 1: Calling Photoroom Edit API for flat-lay generation...");
    const editRes = await fetch("https://image-api.photoroom.com/v2/edit", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: editFormData,
    });

    if (!editRes.ok) {
      const errorText = await editRes.text();
      throw new Error(`Photoroom Generative API Error (${editRes.status}): ${errorText}`);
    }

    const flatLayBlob = await editRes.blob();
    console.log(`Step 1 complete: flat-lay blob ${flatLayBlob.size} bytes`);

    // ==========================================
    // STEP 2: Background Removal (Extract to Transparent PNG)
    // ==========================================
    const segmentFormData = new FormData();
    segmentFormData.append("image_file", flatLayBlob, "flatlay.png");

    console.log("Step 2: Calling Photoroom Segment API for bg removal...");
    const segmentRes = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: segmentFormData,
    });

    if (!segmentRes.ok) {
      const errorText = await segmentRes.text();
      throw new Error(`Photoroom Segment API Error (${segmentRes.status}): ${errorText}`);
    }

    const finalTransparentBlob = await segmentRes.blob();
    console.log(`Step 2 complete: transparent PNG ${finalTransparentBlob.size} bytes`);

    return new Response(finalTransparentBlob, {
      headers: { ...corsHeaders, "Content-Type": "image/png" },
      status: 200,
    });
  } catch (error) {
    console.error("process-garment error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
