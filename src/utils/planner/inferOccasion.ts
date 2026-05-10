/**
 * Local, free occasion classifier from calendar event title + location.
 * Wedding maps to `formal` (we do NOT add a separate `wedding` occasion).
 */

export type InferredOccasion =
  | "formal"
  | "work"
  | "dinner"
  | "travel"
  | "gym"
  | "social"
  | "casual";

export interface MinimalEvent {
  title?: string | null;
  location?: string | null;
}

const PATTERNS: Array<{ occ: InferredOccasion; re: RegExp }> = [
  { occ: "formal", re: /\b(wedding|gala|black[\s-]?tie|formal|ceremony|opera)\b/i },
  { occ: "gym", re: /\b(gym|workout|run(ning)?|yoga|pilates|crossfit|spin|hiit|training)\b/i },
  { occ: "travel", re: /\b(flight|airport|trip|travel|hotel|check[-\s]?in|departure|arrival)\b/i },
  { occ: "dinner", re: /\b(dinner|restaurant|drinks|date|cocktail|happy hour|tasting)\b/i },
  { occ: "work", re: /\b(meeting|call|standup|stand-up|client|interview|office|1:1|one[-\s]?on[-\s]?one|review|sync|presentation|conference)\b/i },
  { occ: "social", re: /\b(party|birthday|brunch|hangout|catch[-\s]?up|reunion|baby shower)\b/i },
];

/** Priority for picking the dominant occasion when multiple events on a day. */
export const OCCASION_PRIORITY: InferredOccasion[] = [
  "formal", "work", "dinner", "travel", "gym", "social", "casual",
];

export function inferOccasion(event: MinimalEvent): InferredOccasion {
  const haystack = `${event.title ?? ""} ${event.location ?? ""}`.trim();
  if (!haystack) return "casual";
  for (const { occ, re } of PATTERNS) {
    if (re.test(haystack)) return occ;
  }
  return "casual";
}

export function dominantOccasion(occasions: InferredOccasion[]): InferredOccasion | null {
  if (occasions.length === 0) return null;
  const set = new Set(occasions);
  for (const o of OCCASION_PRIORITY) {
    if (set.has(o)) return o;
  }
  return "casual";
}
