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

/** Warm-layer regex for weather filtering */
const WARM_LAYER_RE = /\b(coat|jacket|sweater|hoodie|cardigan|parka|puffer|fleece)\b/i;

/**
 * Unified outfit generation core.
 * Deterministically flips between Dress and Top+Bottom formulas
 * so users with dresses still get varied combinations.
 */
function generateOutfitCore(
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

  const baseDay = dayOfYear(date);
  const isWarmLayer = (item: StylingItem) =>
    WARM_LAYER_RE.test(item.category || "") || WARM_LAYER_RE.test(item.name || "");

  const canMakeDress = dresses.length > 0;
  const canMakeTopBottom = tops.length > 0 && bottoms.length > 0;

  if (!canMakeDress && !canMakeTopBottom) return [];

  // Coin flip using seeded hash based on date + swapCount
  const formulaSeed = (baseDay * 10) + swapCount;
  const randFormula = seededRandom(formulaSeed);

  let useDressFormula = false;
  if (canMakeDress && canMakeTopBottom) {
    useDressFormula = randFormula > 0.5;
  } else if (canMakeDress) {
    useDressFormula = true;
  }

  // FORMULA A: DRESS + OUTERWEAR
  if (useDressFormula) {
    const selectedDress = pickByHash(dresses, baseDay, 0, swapCount)!;
    if (tempC != null && tempC > 22) return [selectedDress];
    const selectedCoat = pickByHash(outerwear, baseDay, 1, swapCount);
    return selectedCoat ? [selectedDress, selectedCoat] : [selectedDress];
  }

  // FORMULA B: TOP + BOTTOM (+ OUTERWEAR)
  let filteredTops = tops;
  if (tempC != null && tempC > 22) {
    const lightTops = tops.filter((t) => !isWarmLayer(t));
    if (lightTops.length > 0) filteredTops = lightTops;
  }

  const selectedTop = pickByHash(filteredTops, baseDay, 0, swapCount)!;
  const selectedBottom = pickByHash(bottoms, baseDay, 1, swapCount)!;
  const outfit: StylingItem[] = [selectedTop, selectedBottom];

  if (tempC != null && tempC < 15 && outerwear.length > 0) {
    const selectedCoat = pickByHash(outerwear, baseDay, 2, swapCount);
    if (selectedCoat) outfit.push(selectedCoat);
  }

  return outfit;
}

/**
 * Generate a smart outfit for a given date (swap 0).
 */
export function generateSmartOutfit(
  allItems: StylingItem[],
  date: Date,
  tempC?: number | null,
): StylingItem[] {
  return generateOutfitCore(allItems, date, 0, tempC);
}

/**
 * Swap: rotate to the next deterministic outfit by using swapCount.
 */
export function generateSwappedOutfit(
  allItems: StylingItem[],
  date: Date,
  swapCount: number,
  tempC?: number | null,
): StylingItem[] {
  return generateOutfitCore(allItems, date, swapCount, tempC);
}

// ─── Threshold check ────────────────────────────────────────────────────

export const MIN_TOPS = 7;
export const MIN_BOTTOMS = 3;

export function countPools(items: StylingItem[]) {
  const available = items.filter((i) => !i.is_in_laundry);

  const strictTops = available.filter(
    (i) =>
      matchesCategory(i, TOP_RE) &&
      !matchesCategory(i, DRESS_RE) &&
      !matchesCategory(i, OUTERWEAR_RE),
  );
  const bottoms = available.filter(
    (i) => matchesCategory(i, BOTTOM_RE) && !matchesCategory(i, DRESS_RE),
  );
  const dresses = available.filter((i) => matchesCategory(i, DRESS_RE));
  const outerwear = available.filter(
    (i) => matchesCategory(i, OUTERWEAR_RE) && !matchesCategory(i, DRESS_RE),
  );

  const combinedTopsCount = strictTops.length + dresses.length + outerwear.length;
  const meetsThreshold = combinedTopsCount >= MIN_TOPS && bottoms.length >= MIN_BOTTOMS;

  return { topsCount: combinedTopsCount, bottomsCount: bottoms.length, dressesCount: dresses.length, meetsThreshold };
}
