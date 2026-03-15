import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicLook {
  id: string;
  image_path: string;
  occasion: string | null;
  garment_ids: string[] | null;
  created_at: string;
  signed_image_url?: string | null;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
    selfie_url: string | null;
  } | null;
}

export function usePublicFeed() {
  return useQuery({
    queryKey: ["public-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("looks")
        .select(`
          id, image_path, occasion, garment_ids, created_at,
          profiles:user_id (display_name, avatar_url, selfie_url)
        `)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Bulk sign URLs to prevent N+1 network bottleneck
      const pathsToSign = data.map(look => look.image_path).filter(Boolean);
      const signedUrlsMap: Record<string, string> = {};

      if (pathsToSign.length > 0) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from("looks")
          .createSignedUrls(pathsToSign, 3600);

        if (!urlError && urlData) {
          urlData.forEach((u, index) => {
            if (u.signedUrl) signedUrlsMap[pathsToSign[index]] = u.signedUrl;
          });
        }
      }

      // Map signed URLs back to the looks
      return data.map((look) => ({
        ...look,
        signed_image_url: signedUrlsMap[look.image_path] || null
      })) as PublicLook[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
