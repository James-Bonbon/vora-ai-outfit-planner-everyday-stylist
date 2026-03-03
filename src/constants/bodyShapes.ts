export const BODY_SHAPES = [
  { id: "balanced", iconSrc: "/icons/shape-balanced.svg" },
  { id: "shoulders_wider", iconSrc: "/icons/shape-shoulders.svg" },
  { id: "hips_wider", iconSrc: "/icons/shape-hips.svg" },
  { id: "midsection_fuller", iconSrc: "/icons/shape-midsection.svg" },
  { id: "curvy", iconSrc: "/icons/shape-curvy.svg" },
] as const;

export const BODY_SHAPE_LABELS: Record<string, string> = {
  balanced: "Balanced",
  shoulders_wider: "Shoulders Wider",
  hips_wider: "Hips Wider",
  midsection_fuller: "Midsection Fuller",
  curvy: "Curvy",
};
