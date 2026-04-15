import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's JWT
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Collect look IDs before deletion so we can cascade-delete associated likes
    const { data: userLooks } = await admin
      .from("looks")
      .select("id")
      .eq("user_id", userId);
    const lookIds = (userLooks ?? []).map((l: any) => l.id);

    // Collect wardrobe IDs for wardrobe_views cleanup
    const { data: userWardrobes } = await admin
      .from("wardrobes")
      .select("id")
      .eq("user_id", userId);
    const wardrobeIds = (userWardrobes ?? []).map((w: any) => w.id);

    // --- Delete database records (order: dependents first) ---
    const errors: string[] = [];

    const del = async (table: string, col: string, value: string | string[]) => {
      const q = Array.isArray(value)
        ? admin.from(table).delete().in(col, value)
        : admin.from(table).delete().eq(col, value);
      const { error } = await q;
      if (error) {
        console.error(`Failed to delete from ${table}:`, error);
        errors.push(`${table}: ${error.message}`);
      }
    };

    // Likes: user's own likes + likes on user's looks
    await del("likes", "user_id", userId);
    if (lookIds.length > 0) {
      await del("likes", "look_id", lookIds);
    }

    // Reports filed by the user
    await del("reports", "reporter_id", userId);

    // Wardrobe views linked to user's wardrobes
    if (wardrobeIds.length > 0) {
      await del("wardrobe_views", "wardrobe_id", wardrobeIds);
    }

    // Planned outfits (depends on lookbook_outfits FK)
    await del("planned_outfits", "user_id", userId);

    // All remaining user-owned tables
    const userTables = [
      "user_feedback",
      "feed_posts",
      "user_calendar_events",
      "outfit_calendar",
      "chat_messages",
      "beauty_products",
      "closet_items",
      "dream_items",
      "lookbook_outfits",
      "looks",
      "wardrobes",
      "profiles",
    ];
    for (const table of userTables) {
      await del(table, "user_id", userId);
    }

    // --- Delete storage files ---
    const buckets = ["selfies", "garments", "looks", "beauty-products", "feed_images"];
    for (const bucket of buckets) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(userId);
        if (files?.length) {
          const paths = files.map((f: any) => `${userId}/${f.name}`);
          await admin.storage.from(bucket).remove(paths);
        }
      } catch (e) {
        console.error(`Storage cleanup failed for bucket ${bucket}:`, e);
        errors.push(`storage/${bucket}: ${(e as Error).message}`);
      }
    }

    // --- Delete auth user last ---
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      throw new Error("Failed to delete account");
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...(errors.length > 0 ? { warnings: errors } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("delete-account error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
