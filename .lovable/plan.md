Plan:

1. Split landmark metadata into three explicit concepts
   - Store `rawAiLandmarks` as the unmodified model output.
   - Store `measurementAnchors` only when the AI span is plausible and confidence is sufficient.
   - Store `layoutAnchors` for proportional preview sizing when the AI span is missing, low-confidence, or implausibly narrow.
   - Preserve backward-compatible fields (`leftUpperAnchor`, `rightUpperAnchor`, `upperBodyWidthAnchor`) only as aliases for layout/rendering where needed, but stop treating them as measured shoulder points unless they come from `measurementAnchors`.

2. Update the landmark prompt
   - In `analyze-garment`, `tag-garment`, and `backfill-garment-landmarks`, revise the prompt to request dress-specific fit measurements:
     - `leftUpperFitAnchor`
     - `rightUpperFitAnchor`
     - `upperBodyFitWidth`
     - `confidence`
     - `notes`
   - Clarify that for asymmetric/sleeveless dresses the target is the upper bodice/chest/armhole fit width, not literal shoulder seams.
   - Ask the model to mark confidence low when the span is ambiguous or implausibly narrow.

3. Refactor normalization/backfill logic
   - Replace the current `normalizeUpperAnchors` behavior with a clearer normalizer that:
     - copies the AI result into `rawAiLandmarks`
     - evaluates AI fit anchors against confidence and plausible width ranges
     - writes valid AI spans to `measurementAnchors` with `source: "ai"`
     - writes expanded/fallback spans to `layoutAnchors` with `source: "ratio_guard"` or `source: "alpha_estimate"`
     - lowers confidence for layout-only fallbacks
     - includes `normalizationReason` / `notes` so the debug UI can explain what happened
   - For the dress case where minRatio expansion is applied, mark the expanded anchors as layout-only estimated scaling, not as a measurement.

4. Update OutfitCollage rendering/debug logic
   - Measurement lines will use only `measurementAnchors` with `source: "ai"` and sufficient confidence.
   - Outfit preview scaling can still use `layoutAnchors` to keep coat/dress proportions visually reasonable.
   - Debug labels will distinguish:
     - measured fit width from AI
     - estimated layout scaling from ratio guard / alpha bounds
   - Remove shoulder wording for layout fallbacks; use labels like `estimated layout scaling` instead.
   - Bottoms still draw no line unless real waist measurement anchors exist.

5. Backfill and verify the exact coat/dress
   - Re-run the backfill for:
     - Loewe Cropped Belted Trench Jacket in Cotton Gabardine
     - Black Asymmetric Sleeveless Dress with Buckle Detail
   - Report for each:
     - `rawAiLandmarks`
     - `measurementAnchors`
     - `layoutAnchors`
     - confidence before/after
     - source (`ai`, `ratio_guard`, or `alpha_estimate`)
     - whether debug measurement line will render
   - Confirm the dress uses layout scaling if needed, but no measured line unless the AI returns a plausible `upperBodyFitWidth`.