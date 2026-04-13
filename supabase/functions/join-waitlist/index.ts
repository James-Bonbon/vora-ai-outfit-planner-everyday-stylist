import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 320)
      throw new Error("Invalid email address.");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Save to Database
    const { error: dbError } = await supabaseClient
      .from("waitlist")
      .insert([{ email: email.trim().toLowerCase() }]);

    // 23505 = unique violation → already on list, treat as success
    if (dbError && dbError.code !== "23505") throw dbError;

    // 2. Send the Ticket via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("Missing Resend API Key.");

    const emailHtml = `
      <div style="background-color:#141a24;padding:60px 30px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;color:#e8e0d0;">
        <div style="max-width:480px;margin:0 auto;">
          <h1 style="font-size:28px;letter-spacing:6px;font-weight:300;color:#c9a96e;margin-bottom:40px;text-transform:uppercase;">
            WELCOME TO THE ATELIER
          </h1>
          <p style="font-size:15px;line-height:1.8;color:#a09888;margin-bottom:30px;">
            You are officially on the list. Keep this email secure — it is your ticket to early access when the private beta opens.
          </p>
          <div style="display:inline-block;padding:14px 36px;border:1px solid #c9a96e;color:#c9a96e;font-size:12px;letter-spacing:4px;text-transform:uppercase;margin-bottom:40px;">
            STATUS: VIP PRIORITY
          </div>
          <p style="font-size:13px;color:#5a5248;margin-top:30px;letter-spacing:2px;text-transform:uppercase;">
            Prepare your wardrobe.
          </p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "VORA Waitlist <onboarding@resend.dev>",
        to: [email.trim().toLowerCase()],
        subject: "Your Early Access Ticket",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const resendError = await res.text();
      console.error("Resend API Error:", resendError);
      // Don't throw — DB save succeeded, email failure shouldn't block success
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("join-waitlist error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
