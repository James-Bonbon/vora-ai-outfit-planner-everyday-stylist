/**
 * Lightweight currency symbol detection based on the user's timezone.
 * Returns '£' for UK timezones, '$' for everything else.
 */
export function getCurrencySymbol(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Europe/London" || tz === "Europe/Belfast" || tz === "Europe/Isle_of_Man" || tz === "Europe/Jersey" || tz === "Europe/Guernsey") {
      return "£";
    }
  } catch {
    // fallback
  }
  return "$";
}
