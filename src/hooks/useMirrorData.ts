import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getSignedUrl } from "@/utils/urlCache";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ClosetItem {
  id: string;
  image_url: string;
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
    queryKey: ["profile-data", user?.id], // Reverted to avoid collision with ProfilePage
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("body_shape")
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

      // If ProfilePage saved a full public URL, use it directly!
      if (profile.selfie_url.startsWith("http")) {
        return profile.selfie_url;
      }

      // Fallback for legacy short paths
      const { data } = await supabase.storage.from("selfies").createSignedUrl(profile.selfie_url, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!user,
    staleTime: 0, // Force fresh fetch to prevent stale cache
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
        .select("id, image_url, name, category, is_in_laundry")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!data) return { items: [] as StylistItem[], urls: {} as Record<string, string> };

      // Filter out laundry items for display in try-on
      const availableItems: StylistItem[] = data
        .filter((item) => !item.is_in_laundry)
        .map((item) => ({ ...item, source: "closet" as const }));

      // Batch sign all URLs in parallel
      const urlEntries = await Promise.all(
        availableItems.map(async (item) => {
          const url = await getSignedUrl("garments", item.image_url);
          return [item.id, url || ""] as const;
        })
      );

      return {
        items: availableItems,
        urls: Object.fromEntries(urlEntries) as Record<string, string>,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
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

      // Sign URLs — dream items may be external URLs or bucket paths
      const urlEntries = await Promise.all(
        dreamItems.map(async (item) => {
          const isPath = !item.image_url.startsWith("http");
          if (isPath) {
            const url = await getSignedUrl("garments", item.image_url);
            return [item.id, url || ""] as const;
          }
          return [item.id, item.image_url] as const;
        })
      );

      return {
        items: dreamItems,
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
        .select("id, image_path, occasion, garment_ids, created_at, is_public")
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
    desiredLook?: string | null;
    weather?: string | null;
    bodyShape?: string | null;
  }>({
    mutationKey: ["virtual-tryon"],
    mutationFn: async ({ selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape }) => {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { selfieUrl, garmentUrls, garmentIds, occasion, desiredLook, weather, bodyShape },
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
      toast.success("Look saved! View it in your gallery.");
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
