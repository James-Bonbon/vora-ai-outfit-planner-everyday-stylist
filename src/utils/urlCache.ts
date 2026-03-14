import { supabase } from "@/integrations/supabase/client";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}:${path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (data?.signedUrl) {
    signedUrlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + 3500_000 });
    return data.signedUrl;
  }
  return null;
}

export const clearUrlCache = () => signedUrlCache.clear();
