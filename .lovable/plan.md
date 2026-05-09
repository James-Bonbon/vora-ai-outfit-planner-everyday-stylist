## Outfit Calendar — Auto-Fill Planner & Shared State (v2)

### Goal
Make Outfit Calendar the single source of truth for daily outfits, add a one-tap "Auto-fill week" flow, keep the Home preview perfectly in sync, and never block on AI or network.

---

### 1. Schema (inspect first, extend minimally)

Before any migration, **inspect the current `outfit_calendar` schema** and reuse existing columns where possible. Existing columns we already have: `date`, `garment_ids`, `occasion`, `weather_*`, `status`, `notes`.

Only add missing fields via migration:
- `source text` — `auto_fill` | `home_swap` | `manual` | `saved_look`
- `debug_info jsonb` — outfit score, reasoning, fallback reasons (editor-only)

Status vocabulary (kept tight — no fourth status):
- `suggested` — system-generated, overwritable
- `planned` — user-committed (covers "user_edited" via `source='manual'`)
- `locked` — never auto-changed

---

### 2. One shared planner engine

Create **`src/utils/planner/suggestOutfit.ts`** as the *single* entry point used by Home, Calendar, Swap, and Auto-fill. No caller may roll its own scoring. Signature:

```ts
suggestOutfitForDate({ date, wardrobe, weather, occasion, recentGarmentIds, excludeIds }): LocalSuggestion
```

It is **fully local**: uses existing `outfitScoring.ts` + `stylingEngine.ts`. No AI, no network, no image generation, no VTON, no heavy scoring on the first render. Returns immediately.

A separate **`refineWithAI(suggestion)`** runs in the background only and may upgrade the suggestion in place when it returns.

---

### 3. Auto-fill flow

In `OutfitCalendarSheet`, add a primary action row:
- **Auto-fill week** (next 7 days, default)
- Secondary: **Auto-fill next 3 days** / **Auto-fill month**

Behavior:
1. **First pass — local only.** For each empty/eligible date in range, call `suggestOutfitForDate`. Persist as `status='suggested', source='auto_fill'`. Cards render < 1s because no AI/network/image-gen runs.
2. **Background AI refinement.** Fan out `score-outfits` calls (already has timeout). When a date's AI result returns, upgrade the row in place and update `debug_info`. Errors are silent — local result stays.
3. **Anti-repeat.** Track key garments used in the previous 3 days; downrank reuse.

**Strict overwrite rules.** Auto-fill MAY touch only:
- empty dates
- rows where `status='suggested' AND source='auto_fill'`

Auto-fill MUST NOT touch:
- `status='planned'`
- `status='locked'`
- `source IN ('manual', 'home_swap', 'saved_look')`

…unless the user explicitly taps **"Replace suggestions"** (a separate confirmation action that widens the overwrite set, never the default).

---

### 4. Home ↔ Calendar sync (no aggressive persistence)

Today's Home outfit card reads `outfit_calendar` for today first.
- If a row exists → render it.
- If missing → generate a local suggestion via `suggestOutfitForDate` and **render it without persisting**.

**Persist only when:**
- the user interacts (Swap, Save, Edit, Lock), OR
- the suggestion has been stable on screen for a short debounce (e.g. 5s) AND the user hasn't navigated away.

This prevents every Home visit from silently creating rows.

Writes:
- **Swap on Home** → upsert today: `status='suggested', source='home_swap'`.
- **Save / Plan on Home** → upsert today: `status='planned', source='manual'`.
- **Calendar edit** → same shared mutation, same query keys.

A `useOutfitForDate(date)` TanStack hook is the only read path; both surfaces share its query key so they cannot disagree.

CTA on Home when any of the next 6 days are empty: **"Plan my week"** → opens planner sheet with Auto-fill highlighted.

---

### 5. Planner UI

Replace text-row planner with a vertical list of **DatePlannerCard**s (default horizon 7 days):

```
┌──────────────────────────────────────┐
│  Mon · 12 May    ☀ 18°  · Work       │
│  ┌───── OutfitCollage ─────┐         │
│  │  [mini garment preview] │  Suggested │
│  └─────────────────────────┘         │
│  Cream knit · Beige trousers · Loafers│
│  [ Swap ] [ Edit ] [ 🔒 Lock ] [ ✓ Save ] │
└──────────────────────────────────────┘
```

Status pill: Suggested (muted) / Planned (primary) / Locked (outline + lock).
Outfit score + `debug_info` shown only in Edit mode.
Tapping the card opens the per-date manual picker (kept as secondary).

---

### 6. Loading & error rules (no blank cards, ever)

- **Wardrobe empty / too few items** → card shows "Not enough wardrobe items — add items to your closet".
- **Weather fetch fails** → fall back to season + style preferences; no error toast.
- **AI scoring fails or times out** → keep local result silently; flag `debug_info.ai_status='fallback'`.
- **Collage render fails** → show stacked garment thumbnails instead.
- **Network offline** → local engine still produces suggestions; persistence queued for next online write (best-effort, no blocking).

---

### 7. Files

- **Migration**: add `source text`, `debug_info jsonb` to `outfit_calendar` (only after schema inspection confirms they're missing).
- **New** `src/utils/planner/suggestOutfit.ts` — shared local engine.
- **New** `src/utils/planner/autoFillRange.ts` — orchestrator (range iteration, anti-repeat, overwrite rules, background AI refine).
- **New** `src/hooks/useOutfitForDate.ts` — shared query + mutations.
- **New** `src/components/calendar/DatePlannerCard.tsx`.
- **Edit** `src/components/calendar/OutfitCalendarSheet.tsx` — Auto-fill action row + DatePlannerCard list.
- **Edit** `src/components/home/OutfitCalendar.tsx` — read via shared hook, "Plan my week" CTA, debounce-then-persist.
- `supabase/functions/score-outfits/index.ts` — already has timeout; no change unless gaps surface.

---

### Acceptance

- Auto-fill week → 7 visual cards render < 1s with **zero** network calls in the first pass.
- AI refinement, when it lands, updates cards silently in place.
- Home and Calendar always agree for today (shared query key).
- Auto-fill never overwrites planned/locked/manual/home_swap rows unless user taps "Replace suggestions".
- Visiting Home does not silently spawn `outfit_calendar` rows.
- Manual date-by-date planning still works as a secondary path.
- No card is ever blank — every failure mode has a defined fallback.

### Out of scope
- Notifications / reminders, drag-to-reorder, sharing planned outfits to Feed.
