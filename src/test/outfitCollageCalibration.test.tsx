import { act } from "react";
import { createRoot } from "react-dom/client";
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

const renderCollage = (upperBodyFitWidth: number) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<OutfitCollage garments={[coat, makeDress(upperBodyFitWidth)]} debugAnchors />));
  return { container, root };
};

const getDressWidth = (container: HTMLElement) => {
  const image = container.querySelector('img[alt="Asymmetric black dress"]') as HTMLImageElement | null;
  const wrapper = image?.parentElement as HTMLDivElement | null;
  return Number(wrapper?.style.width.replace("%", ""));
};

describe("OutfitCollage calibrated fit sizing", () => {
  it("uses human anchors over stale layout anchors and expands the dress box for smaller calibrated fit widths", () => {
    const wide = renderCollage(420);
    const wideDressWidth = getDressWidth(wide.container);
    act(() => wide.root.unmount());
    wide.container.remove();

    const narrow = renderCollage(260);
    const narrowDressWidth = getDressWidth(narrow.container);

    expect(narrowDressWidth).toBeGreaterThan(wideDressWidth);
    expect(narrow.container.textContent).toContain('"source": "human"');
    expect(narrow.container.textContent).toMatch(/final dress\/coat fit ratio: 0\.(8[5-9]|9[0-5])/);
    act(() => narrow.root.unmount());
    narrow.container.remove();
  });
});