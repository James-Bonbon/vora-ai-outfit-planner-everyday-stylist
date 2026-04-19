import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent, batched signed-URL cache for private Supabase Storage paths.
 *
 * - In-memory + localStorage backed (survives page refresh).
 * - Cached for ~50 minutes (signed URLs are issued for 60 min).
 * - Batches missing paths into a single createSignedUrls call per bucket.
 * - Deduplicates concurrent requests for the same path.
 * - Pass-through for absolute http(s) URLs.
 */

type Entry = { url: string; expiresAt: number };

const TTL_MS = 50 * 60 * 1000; // 50 min — under the 60-min Supabase signed URL expiry
const SIGN_SECONDS = 3600;
const STORAGE_KEY = "vora.signedUrlCache.v1";

const memCache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function keyFor(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.expiresAt > now) memCache.set(k, v);
    }
  } catch {
    // ignore — corrupted cache, start fresh
  }
}

function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const out: Record<string, Entry> = {};
      const now = Date.now();
      for (const [k, v] of memCache.entries()) {
        if (v.expiresAt > now) out[k] = v;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // quota exceeded — ignore
    }
  }, 500);
}

function isHttp(p: string) {
  return /^https?:\/\//i.test(p);
}

export async function getCachedSignedUrl(
  bucket: string,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (isHttp(path)) return path;
  hydrate();

  const k = keyFor(bucket, path);
  const cached = memCache.get(k);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const existing = inflight.get(k);
  if (existing) return existing;

  const p = (async () => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGN_SECONDS);
    if (data?.signedUrl) {
      memCache.set(k, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS });
      schedulePersist();
      return data.signedUrl;
    }
    return null;
  })().finally(() => inflight.delete(k));

  inflight.set(k, p);
  return p;
}

/**
 * Returns a path -> signed URL map. Reuses cached entries and only signs
 * missing/expired paths in a single batched call. Pass-through for http URLs.
 */
export async function getCachedSignedUrls(
  bucket: string,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  hydrate();
  const out: Record<string, string> = {};
  const toFetch: string[] = [];
  const seen = new Set<string>();

  for (const raw of paths) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    if (isHttp(raw)) {
      out[raw] = raw;
      continue;
    }
    const cached = memCache.get(keyFor(bucket, raw));
    if (cached && cached.expiresAt > Date.now()) {
      out[raw] = cached.url;
    } else {
      toFetch.push(raw);
    }
  }

  if (toFetch.length === 0) return out;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(toFetch, SIGN_SECONDS);
    if (!error && data) {
      const exp = Date.now() + TTL_MS;
      data.forEach((entry, i) => {
        const path = toFetch[i];
        if (entry.signedUrl) {
          out[path] = entry.signedUrl;
          memCache.set(keyFor(bucket, path), { url: entry.signedUrl, expiresAt: exp });
        }
      });
      schedulePersist();
    }
  } catch (err) {
    console.warn("[signedUrlCache] batch sign failed", err);
  }

  return out;
}

export function clearSignedUrlCache() {
  memCache.clear();
  inflight.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
