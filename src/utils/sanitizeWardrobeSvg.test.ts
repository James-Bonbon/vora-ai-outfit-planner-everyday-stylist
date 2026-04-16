import { describe, it, expect } from "vitest";
import { sanitizeWardrobeSvg } from "./sanitizeWardrobeSvg";

describe("sanitizeWardrobeSvg", () => {
  it("returns empty string for falsy or non-string input", () => {
    expect(sanitizeWardrobeSvg("")).toBe("");
    expect(sanitizeWardrobeSvg(null as unknown as string)).toBe("");
    expect(sanitizeWardrobeSvg(undefined as unknown as string)).toBe("");
  });

  it("preserves a basic safe svg with rects", () => {
    const safe = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="2" height="2" fill="#fff"/></svg>`;
    const out = sanitizeWardrobeSvg(safe);
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).toContain("viewBox");
  });

  it("strips <script> tags", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect x="0" y="0" width="1" height="1"/></svg>`;
    const out = sanitizeWardrobeSvg(malicious);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("alert(");
  });

  it("strips inline event handlers like onclick", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" onclick="alert(1)"/></svg>`;
    const out = sanitizeWardrobeSvg(malicious);
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out.toLowerCase()).not.toContain("alert(");
  });

  it("strips foreignObject", () => {
    const malicious = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="javascript:alert(1)"/></foreignObject></svg>`;
    const out = sanitizeWardrobeSvg(malicious);
    expect(out.toLowerCase()).not.toContain("foreignobject");
    expect(out.toLowerCase()).not.toContain("iframe");
    expect(out.toLowerCase()).not.toContain("javascript:");
  });
});
