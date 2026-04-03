export interface BoundingBox {
  category: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface CroppedGarment {
  blob: Blob;
  category: string;
}

/**
 * Scans an image for non-transparent pixels and crops to their bounding box,
 * removing excess transparent padding around garments.
 *
 * @param file  The image File/Blob (typically a transparent PNG from bg-removal).
 * @param padding  Extra pixels of breathing room around the crop (default 8).
 * @returns A tightly-cropped PNG Blob.
 */
/**
 * Converts any image format (AVIF, WebP, HEIC, etc.) to a standard PNG Blob
 * to prevent silent failures in downstream processors like @imgly/background-removal.
 */
export async function normalizeToPng(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("normalizeToPng toBlob failed"))),
      "image/png",
    );
  });
}

export async function cropToBoundingBox(
  file: Blob,
  padding = 8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Draw onto an offscreen canvas to read pixel data
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData; // RGBA flat array

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        // non-transparent pixel (threshold 10 to ignore anti-alias fringes)
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If nothing found (fully transparent), return original
  if (maxX < minX || maxY < minY) {
    return file;
  }

  // Apply padding, clamped to canvas bounds
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext("2d")!;
  cropCtx.drawImage(bitmap, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop toBlob failed"))),
      "image/png",
    );
  });
}
