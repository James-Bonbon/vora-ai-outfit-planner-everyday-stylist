import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getCachedSignedUrl, getCachedSignedUrls } from "@/utils/signedUrlCache";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ClosetItem {
  id: string;
  image_url: string;
  thumbnail_url?: string | null;
  name: string | null;
  category: string | null;
  is_in_laundry: boolean;
}

export interface SavedLook {
  id: string;
  image_path: string;
  occasion: string | null;
  garment_ids: string[] | null;
  created_at: string;
  is_public: boolean;
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

// ─── Queries ────────────────────────────────────────────────────────────

export function useProfileData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-data", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("body_shape, gender, display_name, height_cm, weight_kg")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

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

      // Legacy: if it's already a full URL, use as-is
      if (profile.selfie_url.startsWith("http")) return profile.selfie_url;

      // Otherwise sign from private bucket
      const { data } = await supabase.storage.from("selfies").createSignedUrl(profile.selfie_url, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!user,
    staleTime: 0,
  });
}

export interface StylistItem extends ClosetItem {
  source: "closet" | "dream";
}

export function useClosetItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["closet-items", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("closet_items")
        .select("id, image_url, thumbnail_url, name, category, is_in_laundry")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { items: [] as StylistItem[], urls: {} as Record<string, string> };

      // Filter out laundry items for display in try-on
      const availableItems: StylistItem[] = data
        .filter((item: any) => !item.is_in_laundry)
        .map((item: any) => ({ ...item, source: "closet" as const }));

      // For the selector grid we use thumbnails (fall back to full image for legacy rows).
      // The full image_url is preserved on the item for try-on.
      const previewPaths = availableItems.map((it: any) => it.thumbnail_url || it.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", previewPaths);

      const urls: Record<string, string> = {};
      for (const it of availableItems as any[]) {
        const path = it.thumbnail_url || it.image_url;
        if (path && urlMap[path]) urls[it.id] = urlMap[path];
      }

      return { items: availableItems, urls };
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
}

export function useDreamItems() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dream-items-stylist", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dream_items")
        .select("id, image_url, name, brand, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { items: [] as StylistItem[], urls: {} as Record<string, string> };

      const dreamItems: StylistItem[] = data.map((item) => ({
        id: item.id,
        image_url: item.image_url,
        name: item.name,
        category: null,
        is_in_laundry: false,
        source: "dream" as const,
      }));

      // Sign URLs — dream items may be external URLs or bucket paths.
      const paths = dreamItems.map((it) => it.image_url).filter(Boolean) as string[];
      const urlMap = await getCachedSignedUrls("garments", paths);

      const urls: Record<string, string> = {};
      for (const it of dreamItems) {
        urls[it.id] = urlMap[it.image_url] || it.image_url;
      }

      return { items: dreamItems, urls };
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
  });
}

export function useSavedLooks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-looks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("looks")
        .select("id, image_path, occasion, garment_ids, created_at, is_public")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { looks: [] as SavedLook[], urls: {} as Record<string, string> };

      // Sign URLs in parallel via shared cache
      const urlEntries = await Promise.all(
        data.map(async (look) => {
          const url = await getCachedSignedUrl("looks", look.image_path);
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

      // Garments may live in either closet_items or dream_items (wishlist).
      // Fetch from both tables concurrently and merge into a single lookup.
      const [closetRes, dreamRes] = await Promise.all([
        supabase
          .from("closet_items")
          .select("id, name, category, color, material, brand")
          .in("id", garmentIds),
        supabase
          .from("dream_items")
          .select("id, name, brand")
          .in("id", garmentIds),
      ]);

      const merged: GarmentInfo[] = [];
      const seen = new Set<string>();

      for (const item of closetRes.data || []) {
        merged.push(item as GarmentInfo);
        seen.add(item.id);
      }
      for (const item of dreamRes.data || []) {
        if (seen.has(item.id)) continue;
        merged.push({
          id: item.id,
          name: item.name ?? null,
          category: null,
          color: null,
          material: null,
          brand: item.brand ?? null,
        });
      }

      return merged;
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
    desiredLook?: string | null;
    weather?: string | null;
    bodyShape?: string | null;
    stylingInstruction?: string | null;
  }>({
    mutationKey: ["virtual-tryon"],
    mutationFn: async ({ selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape, stylingInstruction }) => {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape, stylingInstruction },
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
    mutationFn: async ({ imagePath, occasion, garmentIds, bodyShape }: {
      imagePath: string;
      occasion: string | null;
      garmentIds: string[];
      bodyShape?: string | null;
    }) => {
      const { error } = await supabase.from("looks").insert({
        user_id: user!.id,
        image_path: imagePath,
        occasion,
        garment_ids: garmentIds,
        body_shape: bodyShape,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
    },
    onError: (e) => {
      toast.error("Save failed", { description: e.message });
    },
  });
}

export function useTogglePublishMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lookId, isPublic }: { lookId: string; isPublic: boolean }) => {
      const { error } = await supabase
        .from("looks")
        .update({ is_public: isPublic })
        .eq("id", lookId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
      toast.success("Visibility updated!");
    },
    onError: (e) => {
      toast.error("Failed to update visibility", { description: e.message });
    },
  });
}

export function useDeleteLookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (look: SavedLook) => {
      // 1. Storage cleanup
      await supabase.storage.from("looks").remove([look.image_path]);

      // 2. Hard delete the look row
      const { error } = await supabase.from("looks").delete().eq("id", look.id);
      if (error) throw error;

      // 3. Cascade: remove any feed_posts that reference this image
      const { data: signedData } = await supabase.storage
        .from("looks")
        .createSignedUrl(look.image_path, 10);
      // Delete by image_path pattern — feed_posts store the signed URL or path
      await supabase
        .from("feed_posts")
        .delete()
        .like("image_url", `%${look.image_path}%`);

      // 4. Purge the generated_looks_cache so re-generation works
      // The cache entry references image_path
      await supabase
        .from("generated_looks_cache")
        .delete()
        .eq("image_path", look.image_path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("Look deleted");
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: ["saved-looks"] });
      toast.error("Delete failed", { description: e.message });
    },
  });
}
