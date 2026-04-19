/**
 * Generate a small WebP thumbnail (with PNG fallback) from a garment blob.
 * Preserves transparency. Used for fast-loading wardrobe / stylist /
 * calendar preview cards. Full-size image remains the source of truth.
 */
export async function createThumbnail(
  source: Blob,
  maxDim = 512,
): Promise<{ blob: Blob; ext: "webp" | "png"; contentType: string }> {
  const bitmap = await createImageBitmap(source);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Try WebP first (smaller, supports transparency in modern browsers).
  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", 0.82),
  );
  if (webp && webp.size > 0 && webp.type === "image/webp") {
    return { blob: webp, ext: "webp", contentType: "image/webp" };
  }

  const png = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!png) throw new Error("Thumbnail toBlob failed");
  return { blob: png, ext: "png", contentType: "image/png" };
}
