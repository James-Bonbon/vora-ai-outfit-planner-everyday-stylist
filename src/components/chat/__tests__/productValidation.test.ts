import { describe, it, expect } from "vitest";
import {
  isValidHttpUrl,
  validateProducts,
  dedupeQuickActions,
} from "../productValidation";

describe("isValidHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("https://example.com/x?y=1")).toBe(true);
  });
  it("rejects empty, non-http, and garbage", () => {
    expect(isValidHttpUrl(undefined)).toBe(false);
    expect(isValidHttpUrl(null)).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("ftp://x.com")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});

describe("validateProducts", () => {
  it("drops products without a title or valid url", () => {
    const out = validateProducts([
      { title: "", productUrl: "https://a.com/1" },
      { title: "Nice shoe", productUrl: "not-a-url" },
      { title: "Good", productUrl: "https://a.com/good" },
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Good");
  });

  it("nulls invalid imageUrl but keeps the product", () => {
    const out = validateProducts([
      { title: "Loafer", productUrl: "https://a.com/x", imageUrl: "javascript:alert(1)" },
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBeNull();
  });

  it("dedupes by URL ignoring tracking params and www", () => {
    const out = validateProducts([
      { title: "A", productUrl: "https://www.shop.com/p/1?utm_source=ig" },
      { title: "A duplicate listing", productUrl: "https://shop.com/p/1?gclid=xyz" },
    ] as any);
    expect(out).toHaveLength(1);
  });

  it("dedupes by normalized title even on different URLs", () => {
    const out = validateProducts([
      { title: "Brown Suede Loafer", productUrl: "https://a.com/1" },
      { title: "brown   suede loafer", productUrl: "https://b.com/2" },
    ] as any);
    expect(out).toHaveLength(1);
  });

  it("caps at the configured max", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: `Item ${i}`,
      productUrl: `https://shop.com/p/${i}`,
    }));
    expect(validateProducts(many as any)).toHaveLength(6);
    expect(validateProducts(many as any, 3)).toHaveLength(3);
  });

  it("returns [] for non-arrays", () => {
    expect(validateProducts(null)).toEqual([]);
    expect(validateProducts(undefined)).toEqual([]);
    expect(validateProducts("nope" as any)).toEqual([]);
  });
});

describe("dedupeQuickActions", () => {
  it("dedupes by normalized label and caps at 4", () => {
    const out = dedupeQuickActions([
      { id: "1", label: "Compare top two" },
      { id: "2", label: "compare top two" },
      { id: "3", label: "Style the first one" },
      { id: "4", label: "Find cheaper options" },
      { id: "5", label: "Use my wardrobe" },
      { id: "6", label: "Save the second one" },
    ] as any);
    expect(out).toHaveLength(4);
    expect(out.map((a) => a.id)).toEqual(["1", "3", "4", "5"]);
  });

  it("drops empty labels and null entries", () => {
    const out = dedupeQuickActions([
      null,
      { label: "" },
      { label: "  " },
      { id: "x", label: "Real" },
    ] as any);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("x");
  });

  it("returns [] for non-arrays", () => {
    expect(dedupeQuickActions(null)).toEqual([]);
    expect(dedupeQuickActions(undefined)).toEqual([]);
  });
});
