import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ClosetItem {
  id: string;
  image_url: string;
  name: string | null;
  category: string | null;
}

export interface SavedLook {
  id: string;
  image_path: string;
  occasion: string | null;
  garment_ids: string[] | null;
  created_at: string;
}

export interface GarmentInfo {
  id: string;
  name: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
}

interface TryOnResult {
  image: string;
  image_path?: string;
  cached: boolean;
}

// ─── Signed URL helper ──────────────────────────────────────────────────

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
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

// ─── Queries ────────────────────────────────────────────────────────────

export function useSelfieUrl() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["selfie-url", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("selfie_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!profile?.selfie_url) return null;
      return getSignedUrl("selfies", profile.selfie_url);
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 min
  });
}

export function useClosetItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["closet-items", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("closet_items")
        .select("id, image_url, name, category")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { items: [] as ClosetItem[], urls: {} as Record<string, string> };

      // Batch sign all URLs in parallel
      const urlEntries = await Promise.all(
        data.map(async (item) => {
          const url = await getSignedUrl("garments", item.image_url);
          return [item.id, url || ""] as const;
        })
      );

      return {
        items: data as ClosetItem[],
        urls: Object.fromEntries(urlEntries) as Record<string, string>,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavedLooks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-looks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("looks")
        .select("id, image_path, occasion, garment_ids, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { looks: [] as SavedLook[], urls: {} as Record<string, string> };

      // Sign URLs in parallel
      const urlEntries = await Promise.all(
        data.map(async (look) => {
          const url = await getSignedUrl("looks", look.image_path);
          return [look.id, url || ""] as const;
        })
      );

      return {
        looks: data as SavedLook[],
        urls: Object.fromEntries(urlEntries) as Record<string, string>,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLookGarments(garmentIds: string[] | null) {
  return useQuery({
    queryKey: ["look-garments", garmentIds],
    queryFn: async () => {
      if (!garmentIds?.length) return [];
      const { data } = await supabase
        .from("closet_items")
        .select("id, name, category, color, material, brand")
        .in("id", garmentIds);
      return (data || []) as GarmentInfo[];
    },
    enabled: !!garmentIds?.length,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────

export function useTryOnMutation() {
  return useMutation<TryOnResult, Error, {
    selfieUrl: string;
    garmentUrls: string[];
    garmentIds: string[];
    occasion: string | null;
  }>({
    mutationKey: ["virtual-tryon"],
    mutationFn: async ({ selfieUrl, garmentUrls, garmentIds, occasion }) => {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { selfieUrl, garmentUrls, garmentIds, occasion },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.image) throw new Error("No image returned");
      return data as TryOnResult;
    },
  });
}

export function useSaveLookMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imagePath, occasion, garmentIds }: {
      imagePath: string;
      occasion: string | null;
      garmentIds: string[];
    }) => {
      const { error } = await supabase.from("looks").insert({
        user_id: user!.id,
        image_path: imagePath,
        occasion,
        garment_ids: garmentIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
      toast.success("Look saved! View it in your gallery.");
    },
    onError: (e) => {
      toast.error("Save failed", { description: e.message });
    },
  });
}

export function useDeleteLookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (look: SavedLook) => {
      await supabase.storage.from("looks").remove([look.image_path]);
      const { error } = await supabase.from("looks").delete().eq("id", look.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
      toast.success("Look deleted");
    },
    onError: (e) => {
      toast.error("Delete failed", { description: e.message });
    },
  });
}
