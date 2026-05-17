/**
 * Phase 5 — shared validation helpers for chat product results & quick actions.
 *
 * Pure functions, no React, so they can be unit-tested in isolation
 * (StylistChat.tsx is too heavy to import from a test file).
 */

export interface MinimalProductLike {
  title?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  [key: string]: unknown;
}

export interface MinimalQuickAction {
  id?: string;
  label?: string | null;
  kind?: string | null;
  [key: string]: unknown;
}

export const isValidHttpUrl = (u?: string | null): u is string => {
  if (!u || typeof u !== "string") return false;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeTitleKey = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeUrlKey = (url: string): string => {
  try {
    const p = new URL(url);
    // Strip tracking-ish params and fragments so the same product on the
    // same retailer dedupes even with different click trackers.
    p.hash = "";
    [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "gclid", "fbclid", "ref", "ref_src", "mc_cid", "mc_eid",
    ].forEach((k) => p.searchParams.delete(k));
    return `${p.hostname.replace(/^www\./, "")}${p.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/**
 * Validate, sanitize and dedupe a product list for safe rendering.
 *
 * Rules (Phase 5):
 *  - title must be a non-empty string
 *  - productUrl must be a valid http(s) URL
 *  - imageUrl is nulled out unless it parses as http(s)
 *  - dedupe by normalized productUrl, then by normalized title
 *  - cap to `max` (default 6)
 */
export function validateProducts<T extends MinimalProductLike>(
  products: readonly T[] | null | undefined,
  max = 6,
): T[] {
  if (!Array.isArray(products)) return [];
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: T[] = [];
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) continue;
    if (!isValidHttpUrl(raw.productUrl)) continue;
    const urlKey = normalizeUrlKey(raw.productUrl as string);
    const titleKey = normalizeTitleKey(title);
    if (seenUrl.has(urlKey) || seenTitle.has(titleKey)) continue;
    seenUrl.add(urlKey);
    seenTitle.add(titleKey);
    const cleanedImage = isValidHttpUrl(raw.imageUrl) ? raw.imageUrl : null;
    out.push({ ...raw, title, imageUrl: cleanedImage } as T);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Dedupe quick actions by normalized label and cap at `max` (default 4).
 * Drops items with empty labels.
 */
export function dedupeQuickActions<T extends MinimalQuickAction>(
  actions: readonly T[] | null | undefined,
  max = 4,
): T[] {
  if (!Array.isArray(actions)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of actions) {
    if (!a) continue;
    const label = typeof a.label === "string" ? a.label.trim() : "";
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}
