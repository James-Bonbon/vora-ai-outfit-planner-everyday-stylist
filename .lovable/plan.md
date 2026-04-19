
## UI Polish Plan — 4 Targeted Fixes

### Fix 1 — Garment title contrast (`SheetTitle` in `GarmentDetailSheet.tsx`, line 288)
The `SheetTitle` uses `font-outfit` only and inherits `text-foreground` from the shared component. The faded look comes from `bg-background` not matching the screenshot context. Add explicit `text-foreground` and bump weight to ensure contrast across themes:
- Change `<SheetTitle className="font-outfit">` → `<SheetTitle className="font-outfit text-foreground font-semibold">`.
- Audit `DetailRow` (line 54-62) — `text-foreground` is already set; no change needed.

### Fix 2 — SmartCamera duplicate close button (`SmartCamera.tsx`, line 198)
The shared `SheetContent` always renders a built-in Radix Close at `absolute right-4 top-4`, sitting behind the RotateCcw button. The custom top-left X (line 202) is sufficient.
- Add `[&>button.absolute]:hidden` to the `SheetContent` className on line 198 — hides only the auto-rendered Radix close inside this one camera sheet. No other sheets affected.

### Fix 3 — Garment detail modal background + z-index (`GarmentDetailSheet.tsx`)
- **Beige background restore** (line 293): the `SafeImage` wrapper currently uses `bg-card` which is dark. Change to `bg-[#F5F5F0]` to restore the beige studio canvas:
  `wrapperClassName="w-full rounded-2xl bg-[#F5F5F0]"`.
- **Z-index bleed-through**: the `WardrobeMap` rendered *inside the sheet* (line 376) is the source of "grid + green rectangle" — but the report describes them bleeding through *from beneath*. The Radix overlay is `z-50` and Sheet content is `z-50`. Likely cause: the dialog's portal places it correctly, but the `WardrobeMap` SVG inside the sheet has its own absolute-positioned highlight. Confirm by adding `relative z-[60]` wrapper around the modal content and ensuring `SheetOverlay` is opaque enough. Recommended fix:
  - Bump `SheetContent` to `z-[60]` on line 286 only for this sheet: add `className="... z-[60]"`.
  - Ensure the WardrobeMap container has `overflow-hidden rounded-xl` so its internal grid stays clipped.

### Fix 4 — Action button icon colors (`GarmentDetailSheet.tsx`, lines 364, 402, 410)
Locate (line 364), Wash It (line 402), and Help Me Clean (line 410) icons currently use `text-primary` (gold/yellow). When the outline button's hover/active state fills with `accent` (also gold), icons disappear.
- Change all three `<Icon className="w-4 h-4 text-primary" />` → `<Icon className="w-4 h-4 text-foreground" />` to match the Edit Details icon (line 353), which has no color override and inherits foreground.

### Files touched
- `src/components/wardrobe/GarmentDetailSheet.tsx` (4 small className edits)
- `src/components/wardrobe/SmartCamera.tsx` (1 className edit)

No new components, no layout changes, no behavior changes.
