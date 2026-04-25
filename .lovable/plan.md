I’ll implement the clarified debug overlay behavior.

Plan:

1. Upper-body line rules
   - For coats, jackets, tops, and other upper-body garments, draw the upper-body measurement line only when real `leftUpperAnchor` and `rightUpperAnchor` metadata exists with sufficient confidence.
   - For dresses, use the same strict rule: no fallback/estimated upper-body line unless it is explicitly marked as estimated.
   - The measurement line will represent only:
     ```text
     leftUpperAnchor -> rightUpperAnchor
     ```

2. Mobile-safe endpoint labels
   - Label endpoint dots with short labels:
     - `L upper`
     - `R upper`
   - Keep full names (`leftUpperAnchor`, `rightUpperAnchor`) in the debug tooltip/panel instead of next to the dots.
   - Offset labels so they do not cover endpoint dots.

3. Bottoms behavior
   - Do not draw any shoulder/upper-body line for trousers or bottoms.
   - Only draw a bottom measurement if real `leftWaistAnchor` and `rightWaistAnchor` metadata exists.
   - If waist anchors exist, label endpoints:
     - `L waist`
     - `R waist`
   - If waist anchors do not exist, draw no measurement line for bottoms.

4. Visual clarity fixes
   - Ensure endpoint dots render above labels and panels.
   - Move the garment metrics tooltip/panel away from the anchor endpoints so it cannot hide a coat or dress endpoint.
   - Keep the existing debug toggle behavior in Outfit Calendar and Lookbook unchanged.

Technical details:

- Primary change: `src/components/wardrobe/OutfitCollage.tsx`.
- Extend the local metadata type to optionally support `leftWaistAnchor` and `rightWaistAnchor` for future bottom-specific metadata.
- Add helper logic to distinguish real anchors from estimated/fallback anchors, so the overlay does not visually imply trousers have shoulder landmarks.