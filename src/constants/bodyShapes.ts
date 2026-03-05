export const FEMALE_SHAPES = ["Slim", "Balanced", "Fuller"] as const;
export const MALE_SHAPES = ["Slim", "Athletic", "Broad"] as const;

/** @deprecated Use FEMALE_SHAPES or MALE_SHAPES with getBodyShapes() */
export const BODY_SHAPES = FEMALE_SHAPES;

export type BodyShape = (typeof FEMALE_SHAPES)[number] | (typeof MALE_SHAPES)[number];

export function getBodyShapes(sex?: string | null) {
  return sex === "male" ? [...MALE_SHAPES] : [...FEMALE_SHAPES];
}
