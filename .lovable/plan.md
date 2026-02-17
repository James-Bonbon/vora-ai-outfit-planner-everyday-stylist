
# Dream List Feature -- Revised Implementation Plan

## Overview
Add a "Dream List" tab to the Wardrobe page with a new database table, union type system for garment display, and a "Browse Library" entry point.

---

## Step 1: Database Migration

Create the `dream_items` table with `user_id` as a **foreign key referencing `auth.users`** (per your request).

```text
Table: dream_items
+------------------+-------------------------------+
| Column           | Type                          |
+------------------+-------------------------------+
| id               | uuid (PK, default random)     |
| user_id          | uuid (NOT NULL, FK auth.users) |
| catalog_item_id  | uuid (nullable)               |
| image_url        | text (NOT NULL)               |
| name             | text (nullable)               |
| price            | numeric (nullable)            |
| brand            | text (nullable)               |
| created_at       | timestamptz (default now)     |
+------------------+-------------------------------+
```

SQL:
```text
CREATE TABLE public.dream_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id UUID,
  image_url TEXT NOT NULL,
  name TEXT,
  price NUMERIC,
  brand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dream_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dream items"
  ON public.dream_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dream items"
  ON public.dream_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dream items"
  ON public.dream_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
```

---

## Step 2: Shared Type System

Create a new file `src/types/wardrobe.ts` with a union type approach:

```text
ClosetItem {
  id, image_url, name, category, color, material, brand, notes, created_at
}

DreamItem {
  id, image_url, name, price, brand, catalog_item_id, created_at
}

GarmentDisplay = (ClosetItem & { source: "closet" }) | (DreamItem & { source: "dream" })
```

This tagged union lets `GarmentDetailSheet` use `item.source` to branch logic cleanly without type errors. Fields like `material`, `color`, `notes` only exist on closet items; `price` only on dream items.

---

## Step 3: GarmentDetailSheet Refactor

**Props change:** Accept `GarmentDisplay | null` instead of `GarmentItem | null`.

**Branching by `item.source`:**

| Feature | source: "closet" | source: "dream" |
|---|---|---|
| Image loading | Signed URL from `garments` bucket | Direct URL (external) |
| Detail rows | Category, Color, Material, Brand, Added | Brand, Price, Added |
| "Wash It" button | Shown | Hidden |
| "Help Me Clean" button | Shown | Hidden |
| Delete action | Deletes from `closet_items` + removes storage file | Deletes from `dream_items` only |
| Delete label | "Remove from Wardrobe" | "Remove from Dream List" |

---

## Step 4: WardrobePage UI Refactor

**Tab toggle** at the top using two styled buttons (matching existing design language):
- "My Closet" (default active)
- "Dream List"

**Header actions change by tab:**
- My Closet tab: "+" button opens `AddItemSheet` (existing)
- Dream List tab: "Browse Library" button navigates to `/library`

**Dream List content:**
- Empty state: `GlassCard` with "Build your Dream Wardrobe" title, description, and "Browse Library" button
- Populated state: Same 2-column grid as closet. Dream items use direct `image_url` (no signed URL generation needed). Shows name, price, and brand below image.

**State:** New `activeTab` state (`"closet" | "dream"`), new `dreamItems` array fetched similarly to closet items.

---

## Step 5: Route Setup

- Create `src/pages/LibraryPage.tsx` as a placeholder page with title and back navigation
- Add `/library` route inside the protected `AppLayout` routes in `App.tsx`

---

## Files Changed

| File | Action |
|---|---|
| `supabase/migrations/..._create_dream_items.sql` | Create |
| `src/types/wardrobe.ts` | Create (shared types) |
| `src/pages/LibraryPage.tsx` | Create (placeholder) |
| `src/pages/WardrobePage.tsx` | Modify (tabs, dream list fetch, grid) |
| `src/components/wardrobe/GarmentDetailSheet.tsx` | Modify (accept union type, branch by source) |
| `src/App.tsx` | Modify (add `/library` route) |
