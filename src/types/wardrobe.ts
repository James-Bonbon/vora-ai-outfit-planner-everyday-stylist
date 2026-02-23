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
