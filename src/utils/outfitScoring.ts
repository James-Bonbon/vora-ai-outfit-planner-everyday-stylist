/**
 * Scored & filtered outfit selection.
 *
 * Wraps the deterministic styling engine (`generateSwappedOutfit`) and turns
 * "Swap" into a quality-gated cycle: candidates below the rejection threshold
 * are skipped instead of being shown just because they're next in the rotation.
 */

import {
  generateSmartOutfit,
  generateSwappedOutfit,
  TOP_RE,
  BOTTOM_RE,
  DRESS_RE,
  OUTERWEAR_RE,
  type StylingItem,
} from "./stylingEngine";

// ─── Thresholds ─────────────────────────────────────────────────────────

export const SCORE_STRONG = 85;
export const SCORE_ACCEPTABLE = 70;
export const SCORE_FALLBACK = 55; // used only if wardrobe is sparse
export const SCORE_REJECT = 55;
export const SCORE_NEVER = 40;

export type ConfidenceBand = "strong" | "acceptable" | "low" | "rejected";

export interface ScoredOutfit {
  items: StylingItem[];
  score: number;
  band: ConfidenceBand;
  passes: boolean; // true if >= acceptable, or fallback-allowed
  reasons: string[]; // top positive reasons
  warnings: string[];
  breakdown: Record<string, number>;
  swapIndex: number; // which swap rotation produced it
}

// ─── Helpers ────────────────────────────────────────────────────────────

const FORMAL_RE = /\b(blazer|suit|trousers|oxford|loafers?|heels?|dress shirt|button[- ]?up|silk|wool)\b/i;
const ATHLETIC_RE = /\b(gym|workout|sneaker|trainer|legging|jogger|sweatpants?|hoodie|track)\b/i;
const FORMAL_OCCASION_RE = /\b(meeting|work|office|client|pitch|interview|presentation|conference|business|formal|wedding)\b/i;
const CASUAL_OCCASION_RE = /\b(casual|weekend|brunch|errand|home)\b/i;
const ATHLETIC_OCCASION_RE = /\b(gym|workout|training|fitness|run|yoga|exercise|sport)\b/i;
const WARM_LAYER_RE = /\b(coat|jacket|sweater|hoodie|cardigan|parka|puffer|fleece)\b/i;
const SUMMER_RE = /\b(linen|cotton|chiffon|silk|short|tank|sleeveless)\b/i;
const WINTER_RE = /\b(wool|cashmere|knit|fleece|down|leather|suede)\b/i;

function text(item: StylingItem): string {
  return `${item.category || ""} ${item.name || ""}`.toLowerCase();
}

function matches(item: StylingItem, re: RegExp): boolean {
  return re.test(item.category || "") || re.test(item.name || "");
}

/** Extract a normalized color label from item analysis or name. */
function getColor(item: StylingItem): string | null {
  const a = (item as any).image_analysis;
  if (a?.color) return String(a.color).toLowerCase();
  if (a?.dominant_color) return String(a.dominant_color).toLowerCase();
  const m = text(item).match(
    /\b(black|white|cream|ivory|beige|tan|brown|camel|navy|blue|denim|grey|gray|charcoal|red|burgundy|pink|rose|green|olive|khaki|yellow|mustard|orange|purple|lavender)\b/,
  );
  return m ? m[1] : null;
}

/** Coarse color family for harmony checks. */
function colorFamily(color: string | null): "neutral" | "warm" | "cool" | "bold" | "unknown" {
  if (!color) return "unknown";
  if (/(black|white|cream|ivory|beige|tan|brown|camel|grey|gray|charcoal|khaki|olive)/.test(color)) return "neutral";
  if (/(red|burgundy|pink|rose|orange|yellow|mustard)/.test(color)) return "warm";
  if (/(navy|blue|denim|green|purple|lavender)/.test(color)) return "cool";
  return "bold";
}

// ─── Individual scoring dimensions ──────────────────────────────────────

function scoreWeather(items: StylingItem[], tempC: number | null | undefined): number {
  if (tempC == null) return 80; // unknown weather is neutral-positive
  const hasOuter = items.some((i) => matches(i, OUTERWEAR_RE) || WARM_LAYER_RE.test(text(i)));
  const hasShorts = items.some((i) => /\b(short|tank|sleeveless)\b/i.test(text(i)));
  if (tempC < 10) return hasOuter ? 95 : 40;
  if (tempC < 15) return hasOuter ? 90 : 65;
  if (tempC > 26) return hasOuter ? 35 : hasShorts ? 95 : 80;
  if (tempC > 22) return hasOuter ? 55 : 88;
  return 85; // 15-22 sweet spot
}

function scoreOccasion(items: StylingItem[], occasion: string | null | undefined): number {
  if (!occasion) return 80;
  const isFormal = FORMAL_OCCASION_RE.test(occasion);
  const isAthletic = ATHLETIC_OCCASION_RE.test(occasion);
  const isCasual = CASUAL_OCCASION_RE.test(occasion);

  const formalCount = items.filter((i) => FORMAL_RE.test(text(i))).length;
  const athleticCount = items.filter((i) => ATHLETIC_RE.test(text(i))).length;

  if (isFormal) {
    if (athleticCount > 0) return 35;
    if (formalCount >= 1) return 92;
    return 70;
  }
  if (isAthletic) {
    if (formalCount > 0) return 40;
    if (athleticCount >= 1) return 92;
    return 65;
  }
  if (isCasual) {
    if (formalCount >= 2) return 60;
    return 85;
  }
  return 80;
}

function scoreColorHarmony(items: StylingItem[]): number {
  const colors = items.map(getColor);
  const known = colors.filter(Boolean) as string[];
  if (known.length < 2) return 75; // not enough info
  const families = known.map(colorFamily);
  const uniqueFamilies = new Set(families);
  const neutralCount = families.filter((f) => f === "neutral").length;
  const boldCount = families.filter((f) => f === "bold").length;

  if (boldCount >= 2) return 50; // clashing bolds
  if (uniqueFamilies.size === 1) return 88; // monochromatic
  if (neutralCount >= families.length - 1) return 90; // anchored by neutrals
  if (uniqueFamilies.has("warm") && uniqueFamilies.has("cool") && neutralCount === 0) return 60;
  return 80;
}

function scoreSilhouette(items: StylingItem[]): number {
  const hasFittedTop = items.some((i) => /\b(fitted|slim|cropped|tank|tee)\b/i.test(text(i)) && matches(i, TOP_RE));
  const hasLooseTop = items.some((i) => /\b(oversized|relaxed|loose|baggy)\b/i.test(text(i)) && matches(i, TOP_RE));
  const hasFittedBottom = items.some((i) => /\b(skinny|slim|fitted|pencil|legging)\b/i.test(text(i)) && matches(i, BOTTOM_RE));
  const hasLooseBottom = items.some((i) => /\b(wide|baggy|palazzo|relaxed|flare)\b/i.test(text(i)) && matches(i, BOTTOM_RE));

  // Balanced proportion: one fitted + one loose
  if ((hasFittedTop && hasLooseBottom) || (hasLooseTop && hasFittedBottom)) return 92;
  if (hasLooseTop && hasLooseBottom) return 60; // both oversized
  if (hasFittedTop && hasFittedBottom) return 75; // sleek
  return 80; // unknown / neutral
}

function scoreCategoryCompatibility(items: StylingItem[]): number {
  const hasDress = items.some((i) => matches(i, DRESS_RE));
  const hasTop = items.some((i) => matches(i, TOP_RE) && !matches(i, DRESS_RE) && !matches(i, OUTERWEAR_RE));
  const hasBottom = items.some((i) => matches(i, BOTTOM_RE) && !matches(i, DRESS_RE));

  if (hasDress && hasBottom) return 30; // dress over pants without context = invalid
  if (hasDress) return 90;
  if (hasTop && hasBottom) return 90;
  if (hasTop && !hasBottom) return 35;
  if (hasBottom && !hasTop) return 35;
  return 60;
}

function scoreFormalityConsistency(items: StylingItem[]): number {
  const formal = items.filter((i) => FORMAL_RE.test(text(i))).length;
  const athletic = items.filter((i) => ATHLETIC_RE.test(text(i))).length;
  if (formal > 0 && athletic > 0) return 35; // mixed signals
  return 85;
}

function scoreSeasonMaterial(items: StylingItem[], tempC: number | null | undefined): number {
  if (tempC == null) return 80;
  const summer = items.some((i) => SUMMER_RE.test(text(i)));
  const winter = items.some((i) => WINTER_RE.test(text(i)));
  if (tempC > 22 && winter && !summer) return 55;
  if (tempC < 12 && summer && !winter) return 50;
  return 85;
}

function scoreLaundry(items: StylingItem[]): number {
  return items.some((i) => i.is_in_laundry) ? 0 : 100;
}

function scoreRecency(items: StylingItem[], recentSignatures: string[]): number {
  const sig = outfitSignature(items);
  if (recentSignatures.includes(sig)) return 30;
  return 95;
}

// ─── Garment repeat / cooldown ──────────────────────────────────────────

/** Recent outfit history entry — one per past day. */
export interface OutfitHistoryEntry {
  date: string; // yyyy-MM-dd
  garmentIds: string[];
}

/** Pre-computed "days since last worn" map per garment id. */
type DaysSinceMap = Map<string, number>;

function daysBetween(aStr: string, bStr: string): number {
  const a = new Date(aStr + "T00:00:00").getTime();
  const b = new Date(bStr + "T00:00:00").getTime();
  return Math.round(Math.abs(a - b) / 86_400_000);
}

/**
 * Build a map of garmentId → minimum days between targetDate and any
 * historical use of that garment.
 */
export function buildDaysSinceMap(
  history: OutfitHistoryEntry[],
  targetDateStr: string,
): DaysSinceMap {
  const map: DaysSinceMap = new Map();
  for (const entry of history) {
    if (entry.date === targetDateStr) continue; // skip the target day itself
    const days = daysBetween(entry.date, targetDateStr);
    for (const id of entry.garmentIds) {
      const prev = map.get(id);
      if (prev === undefined || days < prev) map.set(id, days);
    }
  }
  return map;
}

/**
 * Count consecutive days a garment has been used immediately preceding the
 * target date. Used to soft-cap outerwear repeats.
 */
function consecutiveStreak(
  history: OutfitHistoryEntry[],
  targetDateStr: string,
  garmentId: string,
): number {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  let expected = new Date(targetDateStr + "T00:00:00");
  expected.setDate(expected.getDate() - 1);
  for (const entry of sorted) {
    const expectedStr = expected.toISOString().slice(0, 10);
    if (entry.date !== expectedStr) {
      if (entry.date < expectedStr) break;
      continue;
    }
    if (!entry.garmentIds.includes(garmentId)) break;
    streak++;
    expected.setDate(expected.getDate() - 1);
  }
  return streak;
}

interface RepeatScoreResult {
  score: number;
  hardReject: boolean;
  reasons: string[];
}

/**
 * Penalize candidates that re-use main garments worn recently.
 *
 * - Same outfit (exact signature) within 14d → hard reject (handled separately
 *   by recentSignatures, but we double-down here at 30 score).
 * - Main garment (top/bottom/dress) used yesterday → hard reject unless sparse.
 * - Used in last 3 days → heavy penalty.
 * - Used in last 7 days → light penalty.
 * - Outerwear is exempt unless worn 3+ consecutive days.
 */
function scoreGarmentRepeats(
  items: StylingItem[],
  history: OutfitHistoryEntry[],
  targetDateStr: string,
  daysSince: DaysSinceMap,
  wardrobeIsSparse: boolean,
): RepeatScoreResult {
  if (history.length === 0) return { score: 95, hardReject: false, reasons: [] };

  let score = 100;
  let hardReject = false;
  const reasons: string[] = [];

  for (const item of items) {
    const isOuter = matches(item, OUTERWEAR_RE);
    const isMain =
      !isOuter &&
      (matches(item, TOP_RE) || matches(item, BOTTOM_RE) || matches(item, DRESS_RE));
    const days = daysSince.get(item.id);
    if (days === undefined) continue;

    if (isOuter) {
      const streak = consecutiveStreak(history, targetDateStr, item.id);
      if (streak >= 3) {
        score -= 25;
        reasons.push(`outerwear "${item.name || "item"}" worn ${streak} days running`);
      } else if (days === 1) {
        // outerwear repeating yesterday is fine (cold weather), small nudge only
        score -= 3;
      }
      continue;
    }

    if (isMain) {
      if (days === 1) {
        if (!wardrobeIsSparse) {
          hardReject = true;
          reasons.push(`"${item.name || "item"}" worn yesterday`);
        } else {
          score -= 30;
          reasons.push(`"${item.name || "item"}" worn yesterday (sparse wardrobe)`);
        }
      } else if (days <= 3) {
        score -= 22;
        reasons.push(`"${item.name || "item"}" worn ${days}d ago`);
      } else if (days <= 7) {
        score -= 10;
      } else if (days <= 14) {
        score -= 4;
      }
    } else {
      // Accessories / other: very light touch
      if (days === 1) score -= 3;
    }
  }

  return { score: Math.max(0, score), hardReject, reasons };
}

// ─── Composite scoring ──────────────────────────────────────────────────

const WEIGHTS = {
  weather: 0.16,
  occasion: 0.16,
  color: 0.1,
  silhouette: 0.08,
  category: 0.14,
  formality: 0.08,
  season: 0.05,
  laundry: 0.05,
  recency: 0.06,
  repeats: 0.12,
};

export function outfitSignature(items: StylingItem[]): string {
  return items
    .map((i) => i.id)
    .sort()
    .join("|");
}

export interface ScoreContext {
  tempC: number | null | undefined;
  occasion: string | null | undefined;
  recentSignatures: string[]; // recent outfits to avoid repeating
  history?: OutfitHistoryEntry[];
  targetDateStr?: string;
  daysSince?: DaysSinceMap;
  wardrobeIsSparse?: boolean;
}

export function scoreOutfit(items: StylingItem[], ctx: ScoreContext): ScoredOutfit {
  const repeat = ctx.history && ctx.targetDateStr && ctx.daysSince
    ? scoreGarmentRepeats(items, ctx.history, ctx.targetDateStr, ctx.daysSince, !!ctx.wardrobeIsSparse)
    : { score: 90, hardReject: false, reasons: [] };

  const breakdown = {
    weather: scoreWeather(items, ctx.tempC),
    occasion: scoreOccasion(items, ctx.occasion),
    color: scoreColorHarmony(items),
    silhouette: scoreSilhouette(items),
    category: scoreCategoryCompatibility(items),
    formality: scoreFormalityConsistency(items),
    season: scoreSeasonMaterial(items, ctx.tempC),
    laundry: scoreLaundry(items),
    recency: scoreRecency(items, ctx.recentSignatures),
    repeats: repeat.score,
  };

  let total = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    total += breakdown[k] * WEIGHTS[k];
  }
  let score = Math.round(total);

  // Hard reject: collapse score below NEVER threshold so it gets dropped
  if (repeat.hardReject) score = Math.min(score, SCORE_NEVER - 1);

  const labels: Record<string, string> = {
    weather: "weather-appropriate",
    occasion: "occasion fit",
    color: "color harmony",
    silhouette: "silhouette balance",
    category: "category compatibility",
    formality: "formality consistency",
    season: "seasonal materials",
    laundry: "everything available",
    recency: "fresh combination",
    repeats: "fresh garment rotation",
  };
  const reasons = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([k]) => labels[k]);

  const warnings: string[] = [];
  if (breakdown.laundry === 0) warnings.push("contains laundry item");
  if (breakdown.category < 50) warnings.push("category mismatch");
  if (breakdown.formality < 50) warnings.push("mixed formality");
  if (breakdown.weather < 50) warnings.push("weather mismatch");
  if (breakdown.occasion < 50) warnings.push("occasion mismatch");
  if (repeat.hardReject) warnings.push(`repeat: ${repeat.reasons[0] || "main garment reused"}`);
  else if (repeat.reasons.length > 0 && breakdown.repeats < 70) warnings.push(`repeat: ${repeat.reasons[0]}`);

  let band: ConfidenceBand;
  if (score >= SCORE_STRONG) band = "strong";
  else if (score >= SCORE_ACCEPTABLE) band = "acceptable";
  else if (score >= SCORE_FALLBACK) band = "low";
  else band = "rejected";

  return {
    items,
    score,
    band,
    passes: score >= SCORE_ACCEPTABLE,
    reasons,
    warnings,
    breakdown,
    swapIndex: 0,
  };
}

// ─── Candidate enumeration & selection ──────────────────────────────────

const MAX_CANDIDATES = 40;

export interface FindOptions {
  date: Date;
  tempC: number | null | undefined;
  occasion: string | null | undefined;
  swapCount: number;
  recentSignatures?: string[];
  /** Recent outfit history (last ~14 days). Used for repeat protection. */
  history?: OutfitHistoryEntry[];
  wardrobeIsSparse?: boolean;
}

export interface FindResult {
  outfit: ScoredOutfit | null;
  acceptableCount: number;
  evaluatedCount: number;
  exhausted: boolean;
  fallbackUsed: boolean;
}

export function findNextAcceptableOutfit(
  pool: StylingItem[],
  opts: FindOptions,
): FindResult {
  const targetDateStr = opts.date.toISOString().slice(0, 10);
  const history = opts.history || [];
  const daysSince = buildDaysSinceMap(history, targetDateStr);

  // Auto-build recentSignatures from history (last 14 days)
  const historicalSigs = history
    .filter((h) => daysBetween(h.date, targetDateStr) <= 14)
    .map((h) => [...h.garmentIds].sort().join("|"));
  const recentSignatures = [...(opts.recentSignatures || []), ...historicalSigs];

  const ctx: ScoreContext = {
    tempC: opts.tempC,
    occasion: opts.occasion,
    recentSignatures,
    history,
    targetDateStr,
    daysSince,
    wardrobeIsSparse: opts.wardrobeIsSparse,
  };

  const seen = new Set<string>();
  const scored: ScoredOutfit[] = [];

  for (let i = 0; i < MAX_CANDIDATES; i++) {
    const items =
      i === 0
        ? generateSmartOutfit(pool, opts.date, opts.tempC, opts.occasion)
        : generateSwappedOutfit(pool, opts.date, i, opts.tempC, opts.occasion);
    if (!items.length) continue;
    const sig = outfitSignature(items);
    if (seen.has(sig)) continue;
    seen.add(sig);
    const s = scoreOutfit(items, ctx);
    s.swapIndex = i;
    if (s.score >= SCORE_NEVER) scored.push(s);
  }

  const acceptable = scored.filter((s) => s.passes).sort((a, b) => b.score - a.score);

  if (acceptable.length > 0) {
    const idx = opts.swapCount % acceptable.length;
    const exhausted = opts.swapCount > 0 && opts.swapCount >= acceptable.length;
    return {
      outfit: acceptable[idx],
      acceptableCount: acceptable.length,
      evaluatedCount: scored.length,
      exhausted,
      fallbackUsed: false,
    };
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return { outfit: null, acceptableCount: 0, evaluatedCount: 0, exhausted: true, fallbackUsed: false };
  }
  best.warnings = [...best.warnings, "limited wardrobe options"];
  best.passes = false;
  return {
    outfit: best,
    acceptableCount: 0,
    evaluatedCount: scored.length,
    exhausted: true,
    fallbackUsed: true,
  };
}

