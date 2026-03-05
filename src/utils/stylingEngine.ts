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
 * Pick an item from a sorted array using a day-based offset to rotate through the wardrobe.
 * dayIndex is typically the day-of-year so each day picks a different item.
 */
function pickByDay<T>(items: T[], dayIndex: number, offset: number = 0): T | null {
  if (items.length === 0) return null;
  const idx = Math.abs(dayIndex + offset) % items.length;
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
export function generateSmartOutfit(
  allItems: StylingItem[],
  date: Date,
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

  // Formula A: Dress + optional Outerwear
  if (dresses.length > 0) {
    const selectedDress = pickByDay(dresses, day, 0)!;
    const selectedCoat = pickByDay(outerwear, day, 1);
    return selectedCoat ? [selectedDress, selectedCoat] : [selectedDress];
  }

  // Formula B: Top + Bottom
  if (tops.length > 0 && bottoms.length > 0) {
    const selectedTop = pickByDay(tops, day, 0)!;
    const selectedBottom = pickByDay(bottoms, day, 1)!;
    return [selectedTop, selectedBottom];
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

  if (dresses.length > 0) {
    const selectedDress = pickByDay(dresses, day, 0)!;
    const selectedCoat = pickByDay(outerwear, day, 1);
    return selectedCoat ? [selectedDress, selectedCoat] : [selectedDress];
  }

  if (tops.length > 0 && bottoms.length > 0) {
    return [pickByDay(tops, day, 0)!, pickByDay(bottoms, day, 1)!];
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
