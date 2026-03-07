/**
 * Deterministic, rules-based Styling Engine for outfit suggestions.
 * Zero use of Math.random() — all selections are seeded by date for rotation.
 */

// ─── Category Regex Identifiers ─────────────────────────────────────────

export const TOP_RE = /\b(top|shirt|blouse|t-shirt|tee|sweater|hoodie|polo|camisole|knit)\b/i;
export const BOTTOM_RE = /\b(bottom|pants|jeans|skirt|shorts|trousers|chinos|sweatpants)\b/i;
export const DRESS_RE = /\b(dress|jumpsuit|romper|one-piece)\b/i;
export const OUTERWEAR_RE = /\b(coat|jacket|blazer|cardigan|outerwear)\b/i;

// ─── Types ──────────────────────────────────────────────────────────────

export interface StylingItem {
  id: string;
  name: string | null;
  category: string | null;
  created_at?: string;
  image_url: string;
  source: "closet" | "dream";
  is_in_laundry?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function matchesCategory(item: StylingItem, regex: RegExp): boolean {
  return regex.test(item.category || "") || regex.test(item.name || "");
}

/** Sort items deterministically by created_at (ascending), then id as tiebreaker */
function sortDeterministically<T extends { created_at?: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Deterministic seeded pseudo-random: sin-based hash returns 0–1.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Pick an item from a sorted array using a seeded hash so that every
 * (day + offset + swapCount) combination produces a unique selection.
 */
function pickByHash<T>(items: T[], dayIndex: number, offset: number, swapCount: number = 0): T | null {
  if (items.length === 0) return null;
  const seed = (dayIndex * 100) + (offset * 10) + swapCount;
  const rand = seededRandom(seed);
  const idx = Math.floor(rand * items.length);
  return items[idx];
}

/** Get day-of-year from a Date (1-indexed) */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

// ─── Main Styling Engine ────────────────────────────────────────────────

/**
 * Generate a smart outfit for a given date.
 * Uses a deterministic decision tree:
 *   Formula A: Dress + optional Outerwear (prioritised)
 *   Formula B: Top + Bottom
 *   Fallback: empty array (triggers "Add Clothes" state)
 *
 * Items marked as in_laundry are excluded.
 */
/** Warm-layer regex for weather filtering */
const WARM_LAYER_RE = /\b(coat|jacket|sweater|hoodie|cardigan|parka|puffer|fleece)\b/i;

export function generateSmartOutfit(
  allItems: StylingItem[],
  date: Date,
  tempC?: number | null,
): StylingItem[] {
  // Exclude laundry items
  const available = allItems.filter((i) => !i.is_in_laundry);

  // Classify & sort deterministically
  const dresses = sortDeterministically(available.filter((i) => matchesCategory(i, DRESS_RE)));
  const outerwear = sortDeterministically(
    available.filter((i) => matchesCategory(i, OUTERWEAR_RE) && !matchesCategory(i, DRESS_RE)),
  );
  const tops = sortDeterministically(
    available.filter(
      (i) =>
        matchesCategory(i, TOP_RE) &&
        !matchesCategory(i, DRESS_RE) &&
        !matchesCategory(i, OUTERWEAR_RE),
    ),
  );
  const bottoms = sortDeterministically(
    available.filter((i) => matchesCategory(i, BOTTOM_RE) && !matchesCategory(i, DRESS_RE)),
  );

  const day = dayOfYear(date);

  // Weather-aware filtering helper
  const isWarmLayer = (item: StylingItem) =>
    WARM_LAYER_RE.test(item.category || "") || WARM_LAYER_RE.test(item.name || "");

  // Formula A: Dress + optional Outerwear
  if (dresses.length > 0) {
    const selectedDress = pickByHash(dresses, day, 0)!;
    // Cold: prioritise outerwear; Hot: skip outerwear
    if (tempC != null && tempC > 22) {
      return [selectedDress];
    }
    const selectedCoat = pickByHash(outerwear, day, 1);
    if (tempC != null && tempC < 15 && !selectedCoat && outerwear.length === 0) {
      // no outerwear available, just return dress
      return [selectedDress];
    }
    return selectedCoat ? [selectedDress, selectedCoat] : [selectedDress];
  }

  // Formula B: Top + Bottom (+ optional outerwear in cold)
  if (tops.length > 0 && bottoms.length > 0) {
    let filteredTops = tops;
    // Hot weather: filter out warm layers from tops
    if (tempC != null && tempC > 22) {
      const lightTops = tops.filter((t) => !isWarmLayer(t));
      if (lightTops.length > 0) filteredTops = lightTops;
    }

    const selectedTop = pickByHash(filteredTops, day, 0)!;
    const selectedBottom = pickByHash(bottoms, day, 1)!;
    const outfit: StylingItem[] = [selectedTop, selectedBottom];

    // Cold weather: add outerwear if available
    if (tempC != null && tempC < 15 && outerwear.length > 0) {
      const selectedCoat = pickByHash(outerwear, day, 2);
      if (selectedCoat) outfit.push(selectedCoat);
    }

    return outfit;
  }

  // Fallback
  return [];
}

/**
 * Swap: rotate to the next deterministic outfit by using an offset.
 * swapCount increments each time the user taps "Swap".
 */
export function generateSwappedOutfit(
  allItems: StylingItem[],
  date: Date,
  swapCount: number,
  tempC?: number | null,
): StylingItem[] {
  const available = allItems.filter((i) => !i.is_in_laundry);

  const dresses = sortDeterministically(available.filter((i) => matchesCategory(i, DRESS_RE)));
  const outerwear = sortDeterministically(
    available.filter((i) => matchesCategory(i, OUTERWEAR_RE) && !matchesCategory(i, DRESS_RE)),
  );
  const tops = sortDeterministically(
    available.filter(
      (i) =>
        matchesCategory(i, TOP_RE) &&
        !matchesCategory(i, DRESS_RE) &&
        !matchesCategory(i, OUTERWEAR_RE),
    ),
  );
  const bottoms = sortDeterministically(
    available.filter((i) => matchesCategory(i, BOTTOM_RE) && !matchesCategory(i, DRESS_RE)),
  );

  const day = dayOfYear(date) + swapCount;

  const isWarmLayer = (item: StylingItem) =>
    WARM_LAYER_RE.test(item.category || "") || WARM_LAYER_RE.test(item.name || "");

  if (dresses.length > 0) {
    const selectedDress = pickByDay(dresses, day, 0)!;
    if (tempC != null && tempC > 22) return [selectedDress];
    const selectedCoat = pickByDay(outerwear, day, 1);
    return selectedCoat ? [selectedDress, selectedCoat] : [selectedDress];
  }

  if (tops.length > 0 && bottoms.length > 0) {
    let filteredTops = tops;
    if (tempC != null && tempC > 22) {
      const lightTops = tops.filter((t) => !isWarmLayer(t));
      if (lightTops.length > 0) filteredTops = lightTops;
    }
    const selectedTop = pickByDay(filteredTops, day, 0)!;
    const selectedBottom = pickByDay(bottoms, day, 1)!;
    const outfit: StylingItem[] = [selectedTop, selectedBottom];
    if (tempC != null && tempC < 15 && outerwear.length > 0) {
      const selectedCoat = pickByDay(outerwear, day, 2);
      if (selectedCoat) outfit.push(selectedCoat);
    }
    return outfit;
  }

  return [];
}

// ─── Threshold check ────────────────────────────────────────────────────

export const MIN_TOPS = 7;
export const MIN_BOTTOMS = 3;

export function countPools(items: StylingItem[]) {
  const available = items.filter((i) => !i.is_in_laundry);
  const tops = available.filter(
    (i) =>
      matchesCategory(i, TOP_RE) &&
      !matchesCategory(i, DRESS_RE) &&
      !matchesCategory(i, OUTERWEAR_RE),
  );
  const bottoms = available.filter(
    (i) => matchesCategory(i, BOTTOM_RE) && !matchesCategory(i, DRESS_RE),
  );
  const dresses = available.filter((i) => matchesCategory(i, DRESS_RE));

  // Threshold met if enough tops+bottoms OR at least some dresses
  const meetsThreshold =
    (tops.length >= MIN_TOPS && bottoms.length >= MIN_BOTTOMS) || dresses.length >= 3;

  return { topsCount: tops.length, bottomsCount: bottoms.length, dressesCount: dresses.length, meetsThreshold };
}
