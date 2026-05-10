/**
 * Shared local-only outfit suggestion engine.
 *
 * Single source of truth used by Home, Calendar, Swap, and Auto-fill.
 * Fully synchronous: no AI, no network, no image generation.
 * AI refinement is opt-in via `refineWithAI` and runs in the background.
 */

import {
  findNextAcceptableOutfit,
  findNextAcceptableOutfitAI,
  outfitSignature,
  type ScoredOutfit,
  type OutfitHistoryEntry,
  type FindOptions,
} from "@/utils/outfitScoring";
import { type StylingItem, MIN_TOPS, MIN_BOTTOMS, countPools } from "@/utils/stylingEngine";
import { dominantOccasion, type InferredOccasion } from "./inferOccasion";

export interface EventLike {
  occasion: InferredOccasion;
}

export interface SuggestArgs {
  date: Date;
  wardrobe: StylingItem[];
  tempC?: number | null;
  occasion?: string | null;
  /** Optional calendar events for the date — derives effectiveOccasion. */
  events?: EventLike[];
  swapCount?: number;
  recentSignatures?: string[];
  history?: OutfitHistoryEntry[];
}

/** Resolves the occasion to use for scoring: events override the manual occasion. */
function resolveEffectiveOccasion(args: SuggestArgs): string | null | undefined {
  if (args.events && args.events.length > 0) {
    const dom = dominantOccasion(args.events.map((e) => e.occasion));
    if (dom) return dom;
  }
  return args.occasion ?? null;
}

export interface LocalSuggestion {
  ok: boolean;
  reason?: "wardrobe_too_small" | "no_match";
  items: StylingItem[];
  scored: ScoredOutfit | null;
  signature: string | null;
  fallbackUsed: boolean;
  exhausted: boolean;
}

/** Synchronous, local-only suggestion. Returns immediately. */
export function suggestOutfitForDate(args: SuggestArgs): LocalSuggestion {
  const { wardrobe, date, tempC, swapCount = 0, recentSignatures = [], history = [] } = args;
  const occasion = resolveEffectiveOccasion(args);

  const { topsCount, bottomsCount, meetsThreshold } = countPools(wardrobe);
  const wardrobeIsSparse = (topsCount + bottomsCount) < (MIN_TOPS + MIN_BOTTOMS) + 2;

  if (!meetsThreshold) {
    return { ok: false, reason: "wardrobe_too_small", items: [], scored: null, signature: null, fallbackUsed: false, exhausted: true };
  }

  const result = findNextAcceptableOutfit(wardrobe, {
    date, tempC, occasion, swapCount, recentSignatures, history, wardrobeIsSparse,
  });

  if (!result.outfit) {
    return { ok: false, reason: "no_match", items: [], scored: null, signature: null, fallbackUsed: false, exhausted: true };
  }

  return {
    ok: true,
    items: result.outfit.items,
    scored: result.outfit,
    signature: outfitSignature(result.outfit.items),
    fallbackUsed: result.fallbackUsed,
    exhausted: result.exhausted,
  };
}

/** Background AI refinement. Caller should treat failures as non-fatal. */
export async function refineWithAI(args: SuggestArgs, timeoutMs = 10_000) {
  const { wardrobe, date, tempC, swapCount = 0, recentSignatures = [], history = [] } = args;
  const occasion = resolveEffectiveOccasion(args);
  const { topsCount, bottomsCount, meetsThreshold } = countPools(wardrobe);
  if (!meetsThreshold) return null;
  const wardrobeIsSparse = (topsCount + bottomsCount) < (MIN_TOPS + MIN_BOTTOMS) + 2;

  const opts: FindOptions = { date, tempC, occasion, swapCount, recentSignatures, history, wardrobeIsSparse };

  try {
    return await Promise.race([
      findNextAcceptableOutfitAI(wardrobe, opts),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}
