import { describe, expect, it } from "vitest";
import { buildGarmentFitMetadata } from "@/utils/garmentFitIntelligence";

const analysis = {
  imageWidth: 1000,
  imageHeight: 1400,
  visibleX: 120,
  visibleY: 80,
  visibleWidth: 760,
  visibleHeight: 1240,
  visibleAlphaBounds: { x: 120, y: 80, width: 760, height: 1240 },
};

const fixtures = [
  { name: "asymmetric black dress", category: "Dresses", metadata: { garmentType: "dress", leftUpperFitAnchor: { x: 440, y: 220 }, rightUpperFitAnchor: { x: 610, y: 250 }, upperBodyFitWidth: 170, confidence: 0.94, notes: "strap/diagonal detail" }, expected: "fallback" },
  { name: "sleeveless dress", category: "Dresses", metadata: { garmentType: "dress", leftUpperFitAnchor: { x: 330, y: 230 }, rightUpperFitAnchor: { x: 690, y: 235 }, upperBodyFitWidth: 360, confidence: 0.82 }, expected: "ai" },
  { name: "trench coat", category: "Outerwear", metadata: { garmentType: "coat", leftUpperFitAnchor: { x: 280, y: 220 }, rightUpperFitAnchor: { x: 740, y: 220 }, upperBodyFitWidth: 460, confidence: 0.88 }, expected: "ai" },
  { name: "oversized jacket", category: "Outerwear", metadata: { garmentType: "jacket", leftUpperFitAnchor: { x: 120, y: 220 }, rightUpperFitAnchor: { x: 930, y: 220 }, upperBodyFitWidth: 810, confidence: 0.8, notes: "sleeve spread" }, expected: "fallback" },
  { name: "trousers", category: "Bottoms", metadata: { garmentType: "trousers", leftWaistAnchor: { x: 330, y: 120 }, rightWaistAnchor: { x: 690, y: 120 }, waistFitWidth: 360, confidence: 0.86 }, expected: "ai" },
  { name: "skirt", category: "Bottoms", metadata: { garmentType: "skirt", leftWaistAnchor: { x: 370, y: 120 }, rightWaistAnchor: { x: 650, y: 120 }, waistFitWidth: 280, confidence: 0.78 }, expected: "ai" },
  { name: "folded angled garment", category: "Tops", metadata: { garmentType: "shirt", confidence: 0.25, notes: "folded" }, expected: "fallback" },
];

describe("Garment Fit Intelligence fixtures", () => {
  it.each(fixtures)("classifies $name as $expected", ({ name, category, metadata, expected }) => {
    const result = buildGarmentFitMetadata({ metadata, analysis, category, name });
    expect(result.rawAiLandmarks).toEqual(metadata);
    expect(result.fitValidation?.status).toBe(expected);
    if (expected === "fallback") {
      expect(result.layoutAnchors || result.fitValidation?.rejected?.length).toBeTruthy();
    } else {
      expect(result.validatedMeasurementAnchors).toBeTruthy();
    }
  });
});