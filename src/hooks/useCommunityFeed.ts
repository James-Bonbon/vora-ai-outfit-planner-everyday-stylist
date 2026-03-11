import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunityLook {
  id: string;
  image_path: string;
  occasion: string | null;
  likes_count: number;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    selfie_url: string | null;
  } | null;
}

export function useCommunityFeed() {
  return useQuery({
    queryKey: ["community-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("looks")
        .select(`
          id, image_path, occasion, likes_count, created_at, user_id,
          profiles!inner (display_name, avatar_url, selfie_url)
        `)
        .eq("is_public", true)
        .eq("reported", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!data) return { looks: [], urls: {}, avatarUrls: {} };

      // Batch sign outfit images
      const urlEntries = await Promise.all(
        data.map(async (look) => {
          const { data: urlData } = await supabase.storage
            .from("looks")
            .createSignedUrl(look.image_path, 3600);
          return [look.id, urlData?.signedUrl || ""] as const;
        })
      );

      // Resolve creator avatars
      const avatarEntries = data.map((look) => {
        const p = look.profiles as any;
        let avatar = p?.selfie_url || p?.avatar_url || null;
        if (avatar && !avatar.startsWith("http")) {
          avatar = supabase.storage.from("selfies").getPublicUrl(avatar).data.publicUrl;
        }
        return [look.id, avatar] as const;
      });

      return {
        looks: data as unknown as CommunityLook[],
        urls: Object.fromEntries(urlEntries),
        avatarUrls: Object.fromEntries(avatarEntries),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
