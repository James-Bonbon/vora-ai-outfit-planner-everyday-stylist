import DOMPurify from "dompurify";

/**
 * Strict SVG sanitizer for AI-generated wardrobe map SVGs.
 * Allowlists only safe SVG elements and attributes needed for wardrobe maps.
 * Removes scripts, foreignObject, event handlers, external links, javascript: URLs.
 */

const ALLOWED_TAGS = ["svg", "rect", "g", "defs", "title", "desc"];

const ALLOWED_ATTRS = [
  // Structural
  "id",
  "class",
  "viewBox",
  "xmlns",
  "xmlns:xlink",
  "preserveAspectRatio",
  "width",
  "height",
  // Geometry (rect)
  "x",
  "y",
  "rx",
  "ry",
  // Presentation
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "transform",
  // Style (will be further filtered)
  "style",
];

export function sanitizeWardrobeSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== "string") return "";

  const clean = DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
    ADD_URI_SAFE_ATTR: [],
    FORBID_TAGS: [
      "script",
      "foreignObject",
      "iframe",
      "embed",
      "object",
      "a",
      "use",
      "image",
      "animate",
      "animateTransform",
      "set",
    ],
    FORBID_ATTR: [
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onmouseenter",
      "onmouseleave",
      "onfocus",
      "onblur",
      "xlink:href",
      "href",
    ],
  });

  return clean;
}
