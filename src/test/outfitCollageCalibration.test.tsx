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
    fitBox: { x: 320, y: 260, width: 360, height: 1100, source: "ai", confidence: 0.82, validationStatus: "validated" },
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
    fitBox: { x: 500 - upperBodyFitWidth / 2, y: 250, width: upperBodyFitWidth, height: 1180, source: "human", confidence: 1, validationStatus: "validated" },
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

const fitBox = (x: number, y: number, width: number, height: number, source = "human") => ({ x, y, width, height, source, confidence: 1, validationStatus: "validated" });

const makeGarment = (id: string, name: string, category: string, box = fitBox(320, 240, 360, 920)) => ({
  id,
  name,
  category,
  image_url: `/${id}.png`,
  image_analysis: analysis,
  layout_metadata: { garmentType: category.toLowerCase(), fitBox: box },
});

const renderGarments = (garments: any[]) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<OutfitCollage garments={garments} debugAnchors />));
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
    expect(narrow.container.textContent).toContain('"passFailBasis": "rendered fit line only"');
    expect(narrow.container.textContent).toContain('"outfitArchetype": "dress_outerwear"');
    expect(narrow.container.textContent).toContain('"selectedLayoutTemplate": "relationship_solver"');
    expect(narrow.container.textContent).toContain('"assignedZone": "topLeft"');
    expect(narrow.container.textContent).toContain('"assignedZone": "rightColumn"');
    expect(narrow.container.textContent).toMatch(/"groupOccupancy(Width|Height)Pct":\s*(7\d|8[0-5])/);
    expect(narrow.container.textContent).toContain('"safePaddingPct": 9');
    expect(narrow.container.textContent).toContain('"finalRenderedDressFitLine"');
    expect(narrow.container.textContent).toContain('"dressLocalFitRatio"');
    act(() => narrow.root.unmount());
    narrow.container.remove();
  });

  it.each([
    ["top_bottom", [makeGarment("top", "White shirt", "Tops", fitBox(330, 220, 340, 620)), makeGarment("trousers", "Tailored trousers", "Bottoms", fitBox(330, 120, 340, 1240))], "upper_lower_stack"],
    ["top_bottom", [makeGarment("top2", "Fine knit top", "Tops", fitBox(330, 220, 340, 620)), makeGarment("skirt", "A-line skirt", "Skirt", fitBox(360, 140, 280, 900))], "upper_lower_stack"],
    ["top_bottom_outerwear", [makeGarment("top3", "Cashmere sweater", "Tops", fitBox(340, 230, 320, 620)), makeGarment("pants", "Wide trousers", "Bottoms", fitBox(330, 120, 340, 1240)), coat], "outerwear_frames_inner_layer"],
    ["dress_outerwear", [makeDress(340), coat], "outerwear_frames_inner_layer"],
    ["accessories_only", [makeGarment("longcoat", "Long coat", "Outerwear", fitBox(300, 220, 400, 1200)), makeGarment("shoes", "Leather loafers", "Shoes", fitBox(240, 960, 520, 360))], "accessories_lower_side_non_scaling"],
  ])("solves relationship-aware layout for %s", (archetype, garments, constraint) => {
    const rendered = renderGarments(garments as any[]);
    expect(rendered.container.textContent).toContain(`"outfitArchetype": "${archetype}"`);
    expect(rendered.container.textContent).toContain(constraint);
    expect(rendered.container.textContent).toContain('"constraintsApplied"');
    expect(rendered.container.textContent).toContain('"finalHorizontalCenterOffset"');
    act(() => rendered.root.unmount());
    rendered.container.remove();
  });
});