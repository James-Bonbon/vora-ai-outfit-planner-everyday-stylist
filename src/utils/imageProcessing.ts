export interface BoundingBox {
  category: string;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

/**
 * Conservative post-processor for AI-detected garment bounding boxes.
 * Avoids false-positive multi-garment splits on single product/model photos.
 * - Clamps coords to [0,1]
 * - Drops invalid/tiny boxes (< 8% area)
 * - Merges heavily overlapping boxes (IoU > 0.3)
 * - Merges adjacent same-category boxes (e.g. trouser legs split apart)
 * - If one box dominates (>= 2.5x next-largest), keeps only the dominant one
 */
export function filterBoundingBoxes(boxes: BoundingBox[]): BoundingBox[] {
  if (!Array.isArray(boxes) || boxes.length === 0) return [];

  const clamp = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));
  const area = (b: BoundingBox) =>
    Math.max(0, b.xmax - b.xmin) * Math.max(0, b.ymax - b.ymin);

  let valid = boxes
    .map((b) => ({
      category: b.category || "Tops",
      xmin: clamp(b.xmin),
      ymin: clamp(b.ymin),
      xmax: clamp(b.xmax),
      ymax: clamp(b.ymax),
    }))
    .filter((b) => b.xmax > b.xmin && b.ymax > b.ymin && area(b) >= 0.08);

  if (valid.length <= 1) return valid;

  const iou = (a: BoundingBox, b: BoundingBox) => {
    const ix1 = Math.max(a.xmin, b.xmin);
    const iy1 = Math.max(a.ymin, b.ymin);
    const ix2 = Math.min(a.xmax, b.xmax);
    const iy2 = Math.min(a.ymax, b.ymax);
    const iw = Math.max(0, ix2 - ix1);
    const ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const union = area(a) + area(b) - inter;
    return union > 0 ? inter / union : 0;
  };

  valid.sort((a, b) => area(b) - area(a));
  const kept: BoundingBox[] = [];
  for (const b of valid) {
    if (!kept.some((k) => iou(k, b) > 0.3)) kept.push(b);
  }
  valid = kept;

  // Merge adjacent same-category boxes (e.g. trouser legs)
  const merged: BoundingBox[] = [];
  const used = new Set<number>();
  for (let i = 0; i < valid.length; i++) {
    if (used.has(i)) continue;
    let cur = { ...valid[i] };
    for (let j = i + 1; j < valid.length; j++) {
      if (used.has(j)) continue;
      const o = valid[j];
      if (o.category !== cur.category) continue;
      const xGap = Math.max(0, Math.max(cur.xmin, o.xmin) - Math.min(cur.xmax, o.xmax));
      const yGap = Math.max(0, Math.max(cur.ymin, o.ymin) - Math.min(cur.ymax, o.ymax));
      const xOverlap = Math.min(cur.xmax, o.xmax) - Math.max(cur.xmin, o.xmin);
      const yOverlap = Math.min(cur.ymax, o.ymax) - Math.max(cur.ymin, o.ymin);
      const adjacent = (xGap < 0.04 && yOverlap > 0.2) || (yGap < 0.04 && xOverlap > 0.2);
      if (adjacent) {
        cur = {
          category: cur.category,
          xmin: Math.min(cur.xmin, o.xmin),
          ymin: Math.min(cur.ymin, o.ymin),
          xmax: Math.max(cur.xmax, o.xmax),
          ymax: Math.max(cur.ymax, o.ymax),
        };
        used.add(j);
      }
    }
    used.add(i);
    merged.push(cur);
  }

  if (merged.length <= 1) return merged;

  // Dominance check
  merged.sort((a, b) => area(b) - area(a));
  if (area(merged[0]) >= 2.5 * area(merged[1])) {
    return [merged[0]];
  }

  return merged;
}

export interface CroppedGarment {
  blob: Blob;
  category: string;
}

export interface ImageAnalysis {
  imageWidth: number;
  imageHeight: number;
  visibleX: number;
  visibleY: number;
  visibleWidth: number;
  visibleHeight: number;
  visibleWidthRatio: number;
  visibleHeightRatio: number;
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

export async function calculateVisibleAlphaBounds(file: Blob): Promise<ImageAnalysis | null> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }

  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  bitmap.close();

  if (maxX < minX || maxY < minY) {
    return {
      imageWidth: width,
      imageHeight: height,
      visibleX: 0,
      visibleY: 0,
      visibleWidth: width,
      visibleHeight: height,
      visibleWidthRatio: 1,
      visibleHeightRatio: 1,
    };
  }

  const visibleWidth = maxX - minX + 1;
  const visibleHeight = maxY - minY + 1;

  return {
    imageWidth: width,
    imageHeight: height,
    visibleX: minX,
    visibleY: minY,
    visibleWidth,
    visibleHeight,
    visibleWidthRatio: visibleWidth / width,
    visibleHeightRatio: visibleHeight / height,
  };
}

export const sliceImageByBoundingBoxes = async (
  imageFile: File,
  boxes: BoundingBox[]
): Promise<CroppedGarment[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const croppedItems: CroppedGarment[] = [];

      for (const box of boxes) {
        const paddingX = (box.xmax - box.xmin) * 0.05;
        const paddingY = (box.ymax - box.ymin) * 0.05;

        const safeXmin = Math.max(0, box.xmin - paddingX);
        const safeYmin = Math.max(0, box.ymin - paddingY);
        const safeXmax = Math.min(1, box.xmax + paddingX);
        const safeYmax = Math.min(1, box.ymax + paddingY);

        const startX = safeXmin * img.width;
        const startY = safeYmin * img.height;
        const cropWidth = (safeXmax - safeXmin) * img.width;
        const cropHeight = (safeYmax - safeYmin) * img.height;

        const canvas = document.createElement("canvas");
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        const blob = await new Promise<Blob | null>((resolveBlob) => {
          canvas.toBlob((b) => resolveBlob(b), "image/png");
        });

        if (blob) {
          croppedItems.push({ blob, category: box.category });
        }
      }

      resolve(croppedItems);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for cropping"));
    };

    img.src = objectUrl;
  });
};
