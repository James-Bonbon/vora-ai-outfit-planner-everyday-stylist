# Outfit Calendar v3: History + Calendar Events + Navigation

Upgrade the planner sheet into a real calendar view with past/future navigation, outfit history, and calendar event context that influences auto-fill.

## 1. Schema inspection & extension

Inspect first. Existing `outfit_calendar` already has: `date`, `garment_ids`, `status`, `source`, `debug_info`, `occasion`, `weather_*`, `notes`. Existing `user_calendar_events` already has: `provider`, `external_event_id`, `title`, `start_time`, `end_time`, `location`, `description`, `is_all_day`.

**Migration — add only what's missing:**
- `outfit_calendar.event_ids uuid[]` — calendar events that influenced this date
- `outfit_calendar.worn_at timestamptz` — when user marked worn
- `outfit_calendar.worn_status text` — with **CHECK (worn_status IS NULL OR worn_status IN ('worn','skipped'))**
- `user_calendar_events.inferred_occasion text` — `work` | `dinner` | `gym` | `travel` | `formal` | `social` | `casual`

No new tables. `user_calendar_events` already exists with RLS.

## 2. Occasion inference (local, free)

New `src/utils/planner/inferOccasion.ts`: pure-function classifier from event title + location.
- Keyword regex: `gym|workout|run|yoga|pilates` → gym; `flight|airport|trip|travel|hotel` → travel; `wedding|gala|black tie|formal|ceremony` → **formal** (wedding maps to `formal` — we do not add a separate `wedding` occasion); `dinner|restaurant|drinks|date|cocktail` → dinner; `meeting|call|standup|client|interview|office|1:1` → work; `party|birthday|brunch` → social.
- Default `casual`.
- **Priority** for picking dominant when multiple events on a day: `formal > work > dinner > travel > gym > social > casual`.

Apply on read; persist back to `inferred_occasion` via background update so future queries skip work.

## 3. Shared event hook (local-timezone day grouping)

New `src/hooks/useCalendarEvents.ts`:
- `useCalendarEventsRange(start, days)` — TanStack Query reading `user_calendar_events`.
- **Group by the user's local-timezone date**, not UTC. Use `format(new Date(start_time), 'yyyy-MM-dd')` (date-fns uses local TZ) so a 23:00 UTC event in London still attaches to the correct local day.
- Multi-day or all-day events span every local day they cover.
- Returns `Map<localDateStr, EventWithOccasion[]>` and `dominantOccasion(date)` using priority above.

## 4. Planner engine — events feed both Home & Auto-fill

Extend `suggestOutfitForDate` args with `events?: EventWithOccasion[]`. Inside, resolve `effectiveOccasion = dominantOccasion(events) ?? args.occasion`. The existing scoring engine already keys off `occasion`.

**Strict rule:** Home today fallback AND Calendar auto-fill MUST both call this same `suggestOutfitForDate` with identical `(date, wardrobe, tempC, events, history)` so they cannot produce different outfits for the same date/context. No caller is allowed to roll its own scoring.

`autoFillRange` extends `contextByDate` to `{ tempC, occasion, eventIds, events }` and persists `event_ids` on the row.

## 5. Calendar navigation & history

Rewrite `OutfitCalendarSheet.tsx`:
- Header: `‹ Prev` · current week label (e.g. "Mon 4 — Sun 10 May") · `Next ›`. "This week" pill resets to current week.
- State: `viewStart` = Monday of the visible week (local TZ). Step ±7 days.
- Renders 7 `DatePlannerCard`s for the visible week.
- "Auto-fill week" only operates on **future empty/auto_fill-suggested dates within the visible week**. Disabled if all visible dates are past or non-eligible.
- "Replace suggestions" — overwrites future `auto_fill suggested` rows only.

## 6. Past-date behavior (no automatic generation, ever)

**Hard rule:** past dates must NEVER auto-generate outfits — not on render, not on auto-fill, not on background AI refinement.

`DatePlannerCard.tsx` gains `dateKind: 'past' | 'today' | 'future'`:

- **Past + has row** → render collage read-only. Actions: `View`, `Mark worn` / `Mark skipped` (toggles `worn_status`, sets `worn_at`), `Add note`.
- **Past + no row** → quiet "No outfit recorded" state. Two explicit actions only:
  - `Add outfit` → opens manual garment picker (no suggestion runs).
  - `Suggest outfit` → explicit user action; runs `suggestOutfitForDate` once and saves `status='suggested', source='manual'` (NOT `auto_fill`, so future auto-fill won't touch it).
- **Today** → Swap / Edit / Save. Status pill gains `Worn`.
- **Future** → Swap / Edit / Lock / Save.

Auto-fill orchestrator (`autoFillRange`) skips any date `< today` even if it would otherwise be eligible.

## 7. Event chips on cards

Under the date header, render up to 2 compact event pills (`9:00 Standup` · `19:30 Dinner`) with `+N more` overflow → popover. Visually subordinate to the outfit collage. Hidden entirely if the user has no connected calendar.

## 8. Home ↔ Calendar parity

`OutfitCalendar.tsx` (Home) calls `useCalendarEventsRange(today, 1)` and passes `events` into the same `suggestOutfitForDate` used by auto-fill. Shared TanStack query keys remain the only read path so today's outfit is identical on both surfaces.

`useOutfitForDate` `UpsertOutfitArgs` extends with `eventIds?`, `wornAt?`, `wornStatus?`.

## 9. Loading & empty states

- Events query loading → skeleton chip row, never blocks card.
- No connected calendar → event row hidden silently.
- Past with no row → muted "No outfit recorded" + `Add outfit` / `Suggest outfit` links.
- AI failure → keep local result (existing).

## 10. Files

**New**
- `src/utils/planner/inferOccasion.ts`
- `src/hooks/useCalendarEvents.ts`

**Edit**
- `src/utils/planner/suggestOutfit.ts` — accept `events`, derive effectiveOccasion
- `src/utils/planner/autoFillRange.ts` — events into context, persist `event_ids`, **future-only guard (skip date < today)**, dominant occasion
- `src/components/calendar/DatePlannerCard.tsx` — `dateKind` variants, event chips, Worn pill, past-mode actions (`Add outfit` / `Suggest outfit` explicit only)
- `src/components/calendar/OutfitCalendarSheet.tsx` — week navigation header, history week support, Replace suggestions
- `src/components/home/OutfitCalendar.tsx` — wire today's events into shared `suggestOutfitForDate`
- `src/hooks/useOutfitForDate.ts` — extend `UpsertOutfitArgs` with `eventIds`, `wornAt`, `wornStatus`

**Migration**
- Add columns + `worn_status` CHECK constraint to `outfit_calendar`; `inferred_occasion` to `user_calendar_events`.

## 11. Out of scope

- New OAuth flow for Google/Apple Calendar (assumed already wired via `sync-calendars` + `apple_calendar_url`).
- Drag-to-reorder, month grid view, sharing past outfits to Feed.
- Auto-marking worn from geolocation/time.

## Acceptance

- `‹ Prev` shows last week's outfits; **no outfit is ever generated automatically for past dates**.
- Past empty cards offer `Add outfit` (manual) and `Suggest outfit` (explicit one-shot) — neither runs without a tap.
- `Next ›` future week is auto-fillable; past week's auto-fill action is disabled.
- A connected calendar event "Client dinner 19:30" on Friday → auto-fill picks an elevated outfit and persists `event_ids`. Wedding events → `formal`.
- Home today outfit equals Calendar today outfit because both call the same `suggestOutfitForDate` with the same args.
- Events grouped by local TZ date — a 23:30 local event never leaks to the next day's card.
- `worn_status` constraint rejects values other than `worn`, `skipped`, or null.
- Event chip row never dominates the outfit collage; hidden if no calendar connected.
