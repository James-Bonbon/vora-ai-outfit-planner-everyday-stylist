export interface ClosetItem {
  id: string;
  image_url: string;
  name: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
  notes: string | null;
  is_in_laundry: boolean;
  laundry_added_at: string | null;
  last_laundry_reminder_at: string | null;
  storage_zone_id: string | null;
  created_at: string;
}

export interface DreamItem {
  id: string;
  image_url: string;
  name: string | null;
  price: number | null;
  brand: string | null;
  catalog_item_id: string | null;
  created_at: string;
}

export type GarmentDisplay =
  | (ClosetItem & { source: "closet" })
  | (DreamItem & { source: "dream" });

export interface WardrobeView {
  id: string;
  name: string;
  imageUrl: string;
  svgString: string;
}

export interface Wardrobe {
  id: string;
  title: string;
  views: WardrobeView[];
}
