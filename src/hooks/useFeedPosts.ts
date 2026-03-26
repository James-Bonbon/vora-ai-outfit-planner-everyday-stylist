import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OutfitPost } from "@/data/mockFeedData";

export interface FeedPostRow {
  id: string;
  user_id: string;
  image_url: string;
  description: string;
  outfit_breakdown: any[];
  status: string;
  created_at: string;
}

function rowToOutfitPost(row: FeedPostRow): OutfitPost & { status: string } {
  return {
    id: row.id,
    username: "@user",
    main_image_url: row.image_url,
    description: row.description,
    likesCount: 0,
    isLiked: false,
    outfit_breakdown: Array.isArray(row.outfit_breakdown) ? row.outfit_breakdown : [],
    status: row.status,
  };
}

export function useExplorePosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["feed-posts", "explore"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as FeedPostRow[]).map(rowToOutfitPost);
    },
    enabled: !!user,
  });
}

export function useMyPosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["feed-posts", "my", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_posts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as FeedPostRow[]).map(rowToOutfitPost);
    },
    enabled: !!user,
  });
}

export function useDeleteFeedPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, imagePath }: { postId: string; imagePath?: string }) => {
      if (imagePath) {
        await supabase.storage.from("feed_images").remove([imagePath]);
      }
      const { error } = await supabase.from("feed_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Post deleted");
    },
    onError: () => toast.error("Failed to delete post"),
  });
}
