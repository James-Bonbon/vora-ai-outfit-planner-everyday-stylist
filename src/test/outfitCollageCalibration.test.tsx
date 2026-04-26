import { render, type RenderResult } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OutfitCollage from "@/components/wardrobe/OutfitCollage";

const analysis = {
  imageWidth: 1000,
  imageHeight: 1600,
  visibleX: 100,
  visibleY: 80,
  visibleWidth: 800,
  visibleHeight: 1440,
  visibleWidthRatio: 0.8,
  visibleHeightRatio: 0.9,
};

const coat = {
  id: "coat",
  name: "Trench coat",
  category: "Outerwear",
  image_url: "/coat.png",
  image_analysis: analysis,
  layout_metadata: {
    garmentType: "coat",
    validatedMeasurementAnchors: {
      upperFit: {
        leftUpperFitAnchor: { x: 320, y: 260 },
        rightUpperFitAnchor: { x: 680, y: 260 },
        upperBodyFitWidth: 360,
        source: "ai",
        confidence: 0.82,
      },
    },
  },
};

const makeDress = (upperBodyFitWidth: number) => ({
  id: `dress-${upperBodyFitWidth}`,
  name: "Asymmetric black dress",
  category: "Dress",
  image_url: "/dress.png",
  image_analysis: analysis,
  layout_metadata: {
    garmentType: "dress",
    validatedMeasurementAnchors: {
      upperFit: {
        leftUpperFitAnchor: { x: 500 - upperBodyFitWidth / 2, y: 250 },
        rightUpperFitAnchor: { x: 500 + upperBodyFitWidth / 2, y: 250 },
        upperBodyFitWidth,
        source: "human",
        confidence: 1,
      },
    },
    layoutAnchors: {
      upperFit: {
        leftUpperFitAnchor: { x: 280, y: 240 },
        rightUpperFitAnchor: { x: 720, y: 240 },
        upperBodyFitWidth: 440,
        source: "ratio_guard",
        confidence: 0.49,
      },
    },
  },
});

const getDressWidth = (view: RenderResult) => Number(view.getByAltText("Asymmetric black dress").style.width.replace("%", ""));

describe("OutfitCollage calibrated fit sizing", () => {
  it("uses human anchors over stale layout anchors and expands the dress box for smaller calibrated fit widths", () => {
    const wide = render(<OutfitCollage garments={[coat, makeDress(420)]} debugAnchors />);
    const wideDressWidth = getDressWidth(wide);
    wide.unmount();

    const narrow = render(<OutfitCollage garments={[coat, makeDress(260)]} debugAnchors />);
    const narrowDressWidth = getDressWidth(narrow);

    expect(narrowDressWidth).toBeGreaterThan(wideDressWidth);
    expect(narrow.getAllByText("source: human").length).toBeGreaterThan(0);
    expect(narrow.getByText(/final dress\/coat fit ratio: 0\.90/)).toBeInTheDocument();
  });
});