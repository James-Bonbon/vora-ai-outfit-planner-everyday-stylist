export const BODY_SHAPES = [
  "Hourglass",
  "Pear",
  "Apple",
  "Rectangle",
  "Inverted Triangle",
] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];

/** Map display label to DB value */
export function toDbValue(shape: string): string {
  return shape.toLowerCase().replace(/\s+/g, "_");
}

/** Map DB value back to display label */
export function toDisplayLabel(dbValue: string | null): string {
  if (!dbValue) return "";
  const found = BODY_SHAPES.find(
    (s) => s.toLowerCase().replace(/\s+/g, "_") === dbValue
  );
  return found || dbValue;
}

/** @deprecated – kept for backward compat; use BODY_SHAPES */
export const FEMALE_SHAPES = BODY_SHAPES;
export const MALE_SHAPES = BODY_SHAPES;
export function getBodyShapes(_sex?: string | null) {
  return [...BODY_SHAPES];
}
