import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Minimal ICS parser for VEVENT blocks
function parseICS(text: string) {
  const events: Array<{
    uid: string;
    summary: string;
    dtstart: string;
    dtend: string;
    location: string | null;
    description: string | null;
    isAllDay: boolean;
  }> = [];

  const blocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const get = (key: string): string | null => {
      // Handle folded lines (RFC 5545: lines starting with space/tab are continuations)
      const unfolded = block.replace(/\r?\n[ \t]/g, "");
      const regex = new RegExp(`^${key}[;:](.*)$`, "m");
      const match = unfolded.match(regex);
      return match ? match[1].trim() : null;
    };

    const uid = get("UID") || `ics-${i}-${Date.now()}`;
    const summary = get("SUMMARY") || "Untitled Event";
    const rawStart = get("DTSTART");
    const rawEnd = get("DTEND");
    const location = get("LOCATION");
    const description = get("DESCRIPTION");

    if (!rawStart) continue;

    // Parse ICS date formats: 20260415T100000Z or 20260415 (all-day)
    const parseICSDate = (raw: string): { iso: string; allDay: boolean } => {
      // Strip any VALUE= or TZID= prefix remnants
      const cleaned = raw.replace(/^[^:]*:/, "").replace(/^VALUE=DATE:/i, "");
      if (cleaned.length === 8) {
        // All-day: YYYYMMDD
        return {
          iso: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00Z`,
          allDay: true,
        };
      }
      // DateTime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
      const d = cleaned.replace(/Z$/, "");
      const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`;
      return { iso, allDay: false };
    };

    const start = parseICSDate(rawStart);
    const end = rawEnd
      ? parseICSDate(rawEnd)
      : { iso: start.iso, allDay: start.allDay };

    events.push({
      uid,
      summary,
      dtstart: start.iso,
      dtend: end.iso,
      location: location || null,
      description: description || null,
      isAllDay: start.allDay,
    });
  }
  return events;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Determine user_id from body or auth header
    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body.user_id || null;
    } catch { /* no body */ }

    if (!userId) {
      const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
      if (authHeader) {
        const { data: { user } } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(authHeader);
        userId = user?.id || null;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const timeMin = now.toISOString();
    const timeMax = thirtyDaysLater.toISOString();

    const allEvents: Array<{
      user_id: string;
      external_event_id: string;
      title: string;
      start_time: string;
      end_time: string;
      location: string | null;
      description: string | null;
      is_all_day: boolean;
      provider: string;
    }> = [];

    // --- Apple WebCal ---
    const { data: profile } = await admin
      .from("profiles")
      .select("apple_calendar_url")
      .eq("user_id", userId)
      .single();

    if (profile?.apple_calendar_url) {
      const url = profile.apple_calendar_url.replace("webcal://", "https://");
      console.log("Fetching Apple WebCal:", url);
      try {
        const icsResp = await fetch(url);
        if (icsResp.ok) {
          const icsText = await icsResp.text();
          const parsed = parseICS(icsText);

          for (const ev of parsed) {
            const evStart = new Date(ev.dtstart);
            const evEnd = new Date(ev.dtend);
            if (evEnd >= now && evStart <= thirtyDaysLater) {
              allEvents.push({
                user_id: userId,
                external_event_id: ev.uid,
                title: ev.summary,
                start_time: ev.dtstart,
                end_time: ev.dtend,
                location: ev.location,
                description: ev.description,
                is_all_day: ev.isAllDay,
                provider: "apple",
              });
            }
          }
          console.log(`Apple: ${allEvents.filter(e => e.provider === "apple").length} events in range`);
        } else {
          console.error("Apple fetch failed:", icsResp.status);
        }
      } catch (err) {
        console.error("Apple WebCal error:", err);
      }
    }

    // --- Google Calendar ---
    try {
      const { data: identities } = await admin.auth.admin.getUserById(userId);
      const googleIdentity = identities?.user?.identities?.find(
        (i: any) => i.provider === "google"
      );

      if (googleIdentity?.identity_data?.provider_token) {
        const token = googleIdentity.identity_data.provider_token;
        console.log("Fetching Google Calendar events");

        const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;

        const gcalResp = await fetch(gcalUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (gcalResp.ok) {
          const gcalData = await gcalResp.json();
          for (const item of gcalData.items || []) {
            if (item.status === "cancelled") continue;
            const isAllDay = !!item.start?.date;
            allEvents.push({
              user_id: userId,
              external_event_id: item.id,
              title: item.summary || "Untitled",
              start_time: item.start?.dateTime || `${item.start?.date}T00:00:00Z`,
              end_time: item.end?.dateTime || `${item.end?.date}T00:00:00Z`,
              location: item.location || null,
              description: item.description || null,
              is_all_day: isAllDay,
              provider: "google",
            });
          }
          console.log(`Google: ${allEvents.filter(e => e.provider === "google").length} events`);
        } else {
          const errText = await gcalResp.text();
          console.error("Google Calendar API error:", gcalResp.status, errText);
        }
      }
    } catch (err) {
      console.error("Google Calendar error:", err);
    }

    // --- Upsert into user_calendar_events ---
    let upserted = 0;
    if (allEvents.length > 0) {
      const { error, count } = await admin
        .from("user_calendar_events")
        .upsert(allEvents, {
          onConflict: "user_id,external_event_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Upsert error:", error);
        throw new Error(`DB upsert failed: ${error.message}`);
      }
      upserted = allEvents.length;
    }

    return new Response(
      JSON.stringify({
        synced: upserted,
        apple: allEvents.filter((e) => e.provider === "apple").length,
        google: allEvents.filter((e) => e.provider === "google").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-calendars error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
