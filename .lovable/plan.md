Final Implementation Plan: Dynamic CSS Outfit Collage

1. Create `src/components/wardrobe/OutfitCollage.tsx`
- Add a reusable visual-only component accepting `{ garments: any[] }`.
- Render one unified canvas:
  - `relative w-full aspect-[3/4] bg-secondary/10 rounded-2xl overflow-hidden flex items-center justify-center`
- Normalize category/name text to classify items into:
  - shoes
  - bottoms
  - tops/sweaters
  - outerwear
  - dresses
  - hats
  - bags/other accessories
- Do not use `mix-blend-multiply`.

2. Apply exact centered body-item CSS
- All core body items must include `left-1/2 -translate-x-1/2` so absolute positioning does not jam items against the left edge.
- Shoes:
  - `absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[40%] h-[20%] object-contain drop-shadow-md z-10`
- Bottoms:
  - `absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[65%] h-[50%] object-contain drop-shadow-md z-20`
- Tops/Sweaters without outerwear:
  - `absolute top-[10%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] object-contain drop-shadow-md z-30`
- Outerwear without top:
  - `absolute top-[8%] left-1/2 -translate-x-1/2 w-[75%] h-[55%] object-contain drop-shadow-lg z-40`
- Dresses:
  - `absolute top-[10%] left-1/2 -translate-x-1/2 w-[70%] h-[75%] object-contain drop-shadow-md z-30`

3. Apply split-style overlap for top + outerwear
- If both a top and outerwear exist, avoid a strict 50/50 seam.
- Top renders underneath and starts at 40%:
  - `absolute top-[10%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] object-contain drop-shadow-md z-30 [clip-path:polygon(40%_0,100%_0,100%_100%,40%_100%)]`
- Outerwear renders above and extends to 55%:
  - `absolute top-[8%] left-1/2 -translate-x-1/2 w-[75%] h-[55%] object-contain drop-shadow-lg z-40 [clip-path:polygon(0_0,55%_0,55%_100%,0_100%)]`
- Outerwear keeps the higher z-index and stronger shadow to hide the seam and create depth.

4. Separate hats from bags/accessories
- Hats must render near the head, not the torso:
  - `absolute top-[2%] left-1/2 -translate-x-1/2 w-[40%] h-[20%] object-contain drop-shadow-md z-50`
- Bags/other accessories render to the side:
  - `absolute top-[40%] right-[5%] w-[35%] h-[35%] object-contain drop-shadow-xl z-50`

5. Add duplicate-category collision offsets
- Track how many garments have already rendered per visual category.
- Add cascading offsets for repeated categories so two tops, two bags, two shoes, etc. do not eclipse each other.
- Example offsets:
  - first item: no added offset
  - second item: `translate-x-4 translate-y-4`
  - third item: `-translate-x-4 translate-y-6`
- For centered core body items, combine offsets carefully so they preserve `left-1/2 -translate-x-1/2` centering behavior. This can be done with inline `transform: translateX(calc(-50% + offsetX)) translateY(offsetY)` or equivalent class composition.
- For hats and accessories, vary top/left/right slightly for duplicates so they cascade naturally.

6. Update Lookbook display
- In `src/components/wardrobe/LookbookTab.tsx`, replace the current saved outfit preview using `OutfitFlatLay` with `<OutfitCollage garments={garmentsWithUrls} />`.
- Keep outfit names, delete buttons, empty state, drawer creation, AI auto-fill, and save logic unchanged.

7. Update Stylist Look Detail view with guardrail
- In `src/pages/MirrorPage.tsx`, import `OutfitCollage`.
- Build collage-ready garment objects for `selectedLook` by combining `lookGarments` metadata with existing signed image URLs.
- Place `<OutfitCollage>` at the top of the selected Look Detail view as the hero visual.
- Do not delete the rich “Garments in this look” list. The 64x64 thumbnail rows with brand/title/category/color/material text must remain fully intact below the collage.

8. Optional consistency update for home outfit preview
- In `src/components/home/OutfitCalendar.tsx`, use `OutfitCollage` for visual outfit preview while keeping a separate explicit “See it on me” button/action.
- This keeps the new collage language consistent while preserving the existing cost-control pattern for VTON generation.

Technical notes
- No database changes required.
- No backend changes required.
- No payment changes required.
- Existing signed image URL flows remain unchanged.
- `OutfitFlatLay` can remain available for contexts where its built-in VTON CTA is useful.