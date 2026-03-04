export const BODY_SHAPES = ["Slim", "Balanced", "Fuller"] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
