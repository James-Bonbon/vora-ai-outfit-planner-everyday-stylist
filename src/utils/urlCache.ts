/**
 * Backwards-compatible wrapper around the shared signed URL cache.
 * Kept for legacy import sites — prefer `signedUrlCache` directly.
 */
import { getCachedSignedUrl, clearSignedUrlCache } from "@/utils/signedUrlCache";

export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  return getCachedSignedUrl(bucket, path);
}

export const clearUrlCache = clearSignedUrlCache;
