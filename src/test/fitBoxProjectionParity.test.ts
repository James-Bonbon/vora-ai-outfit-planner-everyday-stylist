import { describe, expect, it } from "vitest";
import {
  getObjectContainRect,
  projectFitBoxToRenderedImage,
  unprojectPointToSourceImage,
} from "@/utils/garmentFitIntelligence";

/**
 * Regression test for the fitBox coordinate-mapping bug:
 *
 *   A fitBox saved on a garment must cover the SAME garment pixels in:
 *     - the garment detail Fit calibration overlay
 *     - the outfit preview debug overlay
 *
 * Both surfaces store the box in canonical source-image pixel coordinates and
 * project it through `getObjectContainRect` / `projectFitBoxToRenderedImage`.
 * As long as both call the shared helper, the box must occupy the same
 * fraction of the rendered image rect regardless of wrapper aspect ratio.
 */

const SOURCE_IMAGE = { imageWidth: 1000, imageHeight: 1400 };
// A representative sweater fitBox in source-image pixels.
const FIT_BOX = { x: 220, y: 240, width: 560, height: 840 };

const fractionOfImageRect = (
  projected: { left: number; top: number; width: number; height: number },
  imageRect: { left: number; top: number; width: number; height: number },
) => ({
  left: (projected.left - imageRect.left) / imageRect.width,
  top: (projected.top - imageRect.top) / imageRect.height,
  width: projected.width / imageRect.width,
  height: projected.height / imageRect.height,
});

describe("fitBox coordinate parity (calibration ↔ outfit preview)", () => {
  it("projects identically through the shared object-contain helper for any wrapper aspect ratio", () => {
    // Calibration: square wrapper (aspect-square)
    const calibrationWrapper = { width: 400, height: 400 };
    const calibrationRect = getObjectContainRect(
      calibrationWrapper.width,
      calibrationWrapper.height,
      SOURCE_IMAGE.imageWidth,
      SOURCE_IMAGE.imageHeight,
    );
    const calibrationProjected = projectFitBoxToRenderedImage(
      FIT_BOX,
      SOURCE_IMAGE,
      calibrationWrapper.width,
      calibrationWrapper.height,
    );

    // Outfit preview: a tall sub-rectangle inside the 3:4 canvas (e.g. a top
    // garment occupies a portion of the canvas with its own aspect ratio).
    const previewWrapper = { width: 300, height: 600 };
    const previewRect = getObjectContainRect(
      previewWrapper.width,
      previewWrapper.height,
      SOURCE_IMAGE.imageWidth,
      SOURCE_IMAGE.imageHeight,
    );
    const previewProjected = projectFitBoxToRenderedImage(
      FIT_BOX,
      SOURCE_IMAGE,
      previewWrapper.width,
      previewWrapper.height,
    );

    const calibrationFraction = fractionOfImageRect(calibrationProjected, calibrationRect);
    const previewFraction = fractionOfImageRect(previewProjected, previewRect);

    // The fitBox must cover the same fraction of the rendered image rect in
    // both surfaces — that's what guarantees the same garment pixels are
    // highlighted regardless of wrapper aspect.
    expect(calibrationFraction.left).toBeCloseTo(previewFraction.left, 5);
    expect(calibrationFraction.top).toBeCloseTo(previewFraction.top, 5);
    expect(calibrationFraction.width).toBeCloseTo(previewFraction.width, 5);
    expect(calibrationFraction.height).toBeCloseTo(previewFraction.height, 5);

    // And the fraction must equal the canonical pixel fraction.
    expect(calibrationFraction.left).toBeCloseTo(FIT_BOX.x / SOURCE_IMAGE.imageWidth, 5);
    expect(calibrationFraction.top).toBeCloseTo(FIT_BOX.y / SOURCE_IMAGE.imageHeight, 5);
    expect(calibrationFraction.width).toBeCloseTo(FIT_BOX.width / SOURCE_IMAGE.imageWidth, 5);
    expect(calibrationFraction.height).toBeCloseTo(FIT_BOX.height / SOURCE_IMAGE.imageHeight, 5);
  });

  it("letterboxes a tall image inside a square wrapper (pillarboxing)", () => {
    const rect = getObjectContainRect(400, 400, SOURCE_IMAGE.imageWidth, SOURCE_IMAGE.imageHeight);
    // Image is 1000x1400 (taller than 1:1) → fits to height, pillarbox sides
    expect(rect.height).toBeCloseTo(400, 5);
    expect(rect.width).toBeCloseTo((1000 / 1400) * 400, 5);
    expect(rect.left).toBeGreaterThan(0);
    expect(rect.top).toBeCloseTo(0, 5);
  });

  it("round-trips a pointer through unproject → project", () => {
    const wrapper = { width: 400, height: 400 };
    const rect = getObjectContainRect(wrapper.width, wrapper.height, SOURCE_IMAGE.imageWidth, SOURCE_IMAGE.imageHeight);
    // Pick a pointer at the center of the rendered image rect.
    const pointer = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const sourcePoint = unprojectPointToSourceImage(pointer.x, pointer.y, SOURCE_IMAGE, wrapper.width, wrapper.height)!;
    expect(sourcePoint.x).toBeCloseTo(SOURCE_IMAGE.imageWidth / 2, 3);
    expect(sourcePoint.y).toBeCloseTo(SOURCE_IMAGE.imageHeight / 2, 3);

    // Re-project a 1×1 pixel box at that source point and confirm it lands
    // back at the same pointer location.
    const reprojected = projectFitBoxToRenderedImage(
      { x: sourcePoint.x, y: sourcePoint.y, width: 1, height: 1 },
      SOURCE_IMAGE,
      wrapper.width,
      wrapper.height,
    );
    expect(reprojected.left).toBeCloseTo(pointer.x, 3);
    expect(reprojected.top).toBeCloseTo(pointer.y, 3);
  });
});
