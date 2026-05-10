/**
 * Auto-fill orchestrator.
 *
 * Generates local-only outfit suggestions for a date range, persists them to
 * `outfit_calendar`, and respects strict overwrite rules.
 *
 * Overwrite policy (default):
 *   - May write into: empty dates, or rows where status='suggested' AND source='auto_fill'
 *   - Skips: planned, locked, or any other source (manual / home_swap / saved_look)
 *   - Pass `replaceSuggestions=true` to widen overwrite to all suggested rows.
 */

import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { OutfitHistoryEntry } from "@/utils/outfitScoring";
import type { StylingItem } from "@/utils/stylingEngine";
import { suggestOutfitForDate, refineWithAI, type EventLike } from "./suggestOutfit";

export type CalendarSource = "auto_fill" | "home_swap" | "manual" | "saved_look";
export type CalendarStatus = "suggested" | "planned" | "locked";

export interface ExistingRow {
  id?: string;
  date: string;
  garment_ids: string[] | null;
  status: CalendarStatus | string;
  source: CalendarSource | string | null;
}

export interface DateContext {
  tempC?: number | null;
  occasion?: string | null;
  events?: (EventLike & { id: string })[];
}

export interface AutoFillArgs {
  userId: string;
  startDate: Date;
  days: number;
  wardrobe: StylingItem[];
  /** Map date -> { tempC, occasion, events } */
  contextByDate: Record<string, DateContext>;
  existing: ExistingRow[];
  pastHistory?: OutfitHistoryEntry[];
  replaceSuggestions?: boolean;
  /** Called whenever a row is upserted, so caller can refresh UI immediately. */
  onProgress?: (date: string, garmentIds: string[]) => void;
  /** Called when AI refinement upgrades a date in the background. */
  onAIRefined?: (date: string, garmentIds: string[]) => void;
}

function isEligibleForOverwrite(row: ExistingRow | undefined, replaceSuggestions: boolean): boolean {
  if (!row) return true;
  if (!row.garment_ids || row.garment_ids.length === 0) return true;
  if (row.status === "locked" || row.status === "planned") return false;
  if (row.status !== "suggested") return false;
  if (replaceSuggestions) return true;
  return row.source === "auto_fill";
}

export async function autoFillRange(args: AutoFillArgs): Promise<{
  filled: string[];
  skipped: string[];
}> {
  const {
    userId, startDate, days, wardrobe, contextByDate,
    existing, pastHistory = [], replaceSuggestions = false,
    onProgress, onAIRefined,
  } = args;

  const existingByDate = new Map(existing.map((r) => [r.date, r]));
  const filled: string[] = [];
  const skipped: string[] = [];

  // Hard rule: never auto-generate for past dates.
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Anti-repeat: build rolling window of garments used in last 3 days (past + already-filled future)
  const recentSignatures: string[] = [];
  const futurePlanned: OutfitHistoryEntry[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, "yyyy-MM-dd");

    // Skip past dates entirely — never auto-generate history.
    if (dateStr < todayStr) {
      skipped.push(dateStr);
      const row = existingByDate.get(dateStr);
      if (row?.garment_ids?.length) {
        futurePlanned.push({ date: dateStr, garmentIds: row.garment_ids });
      }
      continue;
    }

    const row = existingByDate.get(dateStr);
    if (!isEligibleForOverwrite(row, replaceSuggestions)) {
      skipped.push(dateStr);
      if (row?.garment_ids?.length) {
        futurePlanned.push({ date: dateStr, garmentIds: row.garment_ids });
      }
      continue;
    }

    const ctx = contextByDate[dateStr] || {};
    const history: OutfitHistoryEntry[] = [...pastHistory, ...futurePlanned];

    const suggestion = suggestOutfitForDate({
      date,
      wardrobe,
      tempC: ctx.tempC ?? null,
      occasion: ctx.occasion ?? null,
      events: ctx.events,
      recentSignatures,
      history,
    });

    if (!suggestion.ok || suggestion.items.length === 0) {
      skipped.push(dateStr);
      continue;
    }

    const garmentIds = suggestion.items.map((i) => i.id);
    if (suggestion.signature) recentSignatures.unshift(suggestion.signature);
    if (recentSignatures.length > 5) recentSignatures.length = 5;
    futurePlanned.push({ date: dateStr, garmentIds });

    const debugInfo = {
      score: suggestion.scored?.score ?? null,
      band: suggestion.scored?.band ?? null,
      reasons: suggestion.scored?.reasons ?? [],
      warnings: suggestion.scored?.warnings ?? [],
      fallback_used: suggestion.fallbackUsed,
      ai_status: "pending" as const,
      generated_at: new Date().toISOString(),
    };

    const eventIds = (ctx.events || []).map((e) => e.id);

    const payload = {
      user_id: userId,
      date: dateStr,
      garment_ids: garmentIds,
      occasion: ctx.occasion ?? null,
      weather_temp: ctx.tempC ?? null,
      weather_date: dateStr,
      status: "suggested" as const,
      source: "auto_fill" as CalendarSource,
      debug_info: debugInfo,
      event_ids: eventIds,
    };

    const { error } = await (supabase as any)
      .from("outfit_calendar")
      .upsert(payload, { onConflict: "user_id,date" });
    if (error) {
      console.warn("[autoFillRange] upsert failed for", dateStr, error.message);
      skipped.push(dateStr);
      continue;
    }

    filled.push(dateStr);
    onProgress?.(dateStr, garmentIds);
  }

  // Background AI refinement — fire-and-forget per date, never blocks
  if (filled.length > 0 && onAIRefined) {
    void (async () => {
      const CONCURRENCY = 2;
      const queue = [...filled];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          const dateStr = queue.shift()!;
          const date = new Date(dateStr + "T00:00");
          const ctx = contextByDate[dateStr] || {};
          const aiResult = await refineWithAI({
            date,
            wardrobe,
            tempC: ctx.tempC ?? null,
            occasion: ctx.occasion ?? null,
            events: ctx.events,
            history: [...pastHistory, ...futurePlanned],
          });
          if (!aiResult?.outfit) continue;
          const ids = aiResult.outfit.items.map((i) => i.id);
          const debug = {
            score: aiResult.outfit.score,
            band: aiResult.outfit.band,
            reasons: aiResult.outfit.reasons,
            warnings: aiResult.outfit.warnings,
            fallback_used: aiResult.fallbackUsed,
            ai_status: aiResult.aiUsed ? "success" : "fallback",
            generated_at: new Date().toISOString(),
          };
          // Only update if still auto_fill suggested (don't clobber user edits)
          await (supabase as any)
            .from("outfit_calendar")
            .update({ garment_ids: ids, debug_info: debug })
            .eq("user_id", userId)
            .eq("date", dateStr)
            .eq("status", "suggested")
            .eq("source", "auto_fill");
          onAIRefined(dateStr, ids);
        }
      });
      await Promise.all(workers);
    })();
  }

  return { filled, skipped };
}
