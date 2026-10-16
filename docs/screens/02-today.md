# S2 — Today

> Reference: `docs/example-layout/WhatsApp Image 2026-10-17 at 00.03.46.jpeg`

The default landing screen. One question answered above the fold: **what am I
running today, and am I on track?**

## Mobile layout

```
┌────────────────────────────────────────────────┐
│ (◔) ⟲ Week 2/12 ▾                    [17] 🔔   │  header
├────────────────────────────────────────────────┤
│  MON  TUE  WED  THU  FRI  SAT  SUN             │  week strip
│  12   13   14   15  (16) [17]  18              │
│            ·    ·    ·   · ·    ·              │  type dots
├────────────────────────────────────────────────┤
│  Workouts                         🌧 28°       │
│ ┌┬────────────────────────────────────────┐   │
│ ││ Tempo 2-1-1                      ( )   │   │  workout card
│ ││ Friday, Oct 16 · 40m – 45m             │   │
│ ││ Tempo · 6km                            │   │
│ └┴────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────┐    │
│ │ Week 2 Overview                      › │    │
│ │ ▬▬▬ ▭▭▭ ▭▭▭ ▭▭▭ ▭▭▭                    │    │
│ │ Workouts: 1/5      Distance: 6/37.5KM  │    │
│ └────────────────────────────────────────┘    │
├────────────────────────────────────────────────┤
│  My insights                      EXPAND ›     │
│ ┌──────────────┐ ┌──────────────┐             │
│ │ Mileage      │ │ Monitoring   │  horizontal │
│ │ on track     │ │ Pace         │  scroll     │
│ │ 27% · 2/6    │ │ Next speed   │             │
│ │  ▁▃▂         │ │ session in   │             │
│ └──────────────┘ └──────────────┘             │
│       ┌────────────────────────┐               │
│       │  🔗  Link a run        │  floating     │
│       └────────────────────────┘               │
├────────────────────────────────────────────────┤
│  Today   Plan   Calendar   Link   Progress     │
└────────────────────────────────────────────────┘
```

## Components

### Header
- **Avatar** (left) → `/settings`.
- **Week pill** (centre): a circular progress ring showing the week's
  completion fraction, the text `Week 2/12`, and a chevron opening a week
  picker sheet that jumps the strip to any week in the plan.
- **Date chip** `[17]` → `/calendar?date=today`.
- **Bell** → notifications sheet. Dot when unread.

### Week strip
Seven columns, `MON…SUN` above the date.

| Date state | Rendering |
|---|---|
| Today | white filled circle, dark text |
| Selected (≠ today) | `--surface-3` filled circle |
| Past with a missed workout | `--danger` red text |
| Past, complete or rest | `--text-muted` |
| Future | `--text` |

Up to three 6px dots beneath each date, coloured by workout type. Tapping a
date changes the selection and updates `?date=`; swiping left/right moves a
week. The strip is the primary navigation on this screen.

### Workouts section
- Heading plus a **weather chip** (icon + temperature) for the selected day.
  Open-Meteo, free and keyless, by coarse geolocation with a graceful fallback
  to nothing if permission is denied.
- One `<WorkoutCard>` per workout on that day:
  - 6px left colour bar in the type colour
  - Title (`Tempo 2-1-1`)
  - `Friday, Oct 16 · 40m – 45m`
  - `Tempo · 6km`
  - A **completion circle** on the right: tap to complete, long-press for
    Complete / Skip / Move / Link activity
  - If linked: a `⚡` badge plus `6.12km · 5:12/km` and the compliance pill
- Tapping the card → `/workouts/[id]`.
- **Rest day**: an illustrated card — *"Rest day. Recovery is training too."*
  with the next session named underneath.

### Week overview card
- `<SegmentedProgress>`: one segment per planned workout, filled on completion.
  The screenshot shows five empty segments for a 5-workout week.
- `Workouts: 1/5` and `Distance: 6/37.5KM` — planned vs completed, respecting
  the user's unit preference.
- Chevron → `/plan/week/[n]`.

### My insights
A horizontally scrolling row of computed cards from
`GET /api/progress/insights`. Each is a real calculation, not decoration:

| Card | Computation |
|---|---|
| **Mileage on track** | Completed distance ÷ expected-to-date for the current week, as a % with a mini bar chart of the last 3 weeks |
| **Monitoring pace** | Rolling average easy-run pace over 4 weeks vs the prescribed easy zone; flags drift in either direction |
| **Consistency** | Current streak of weeks at ≥80% completion |
| **Next hard session** | Days until the next quality workout, with its name |
| **Recovery** | Days since the last rest day; warns at 7+ |
| **Plan adherence** | Completed ÷ scheduled workouts since plan start |

"EXPAND" opens a full-height sheet with all cards stacked and explained.

### Link a run (floating pill)
A browser can't reliably record GPS in the background, so the app doesn't
pretend to track runs. Tracking here means **linking what you already recorded
in Strava** to what you were supposed to run.

The pill routes to the **[Link tab](./08-link.md)** when there is anything to
reconcile. When today's workout is the only thing outstanding it short-circuits
to a sheet with three options:

1. **Link a Strava activity** — the picker from [S5](./05-workout-detail.md)
2. **Log it manually** — distance, duration, date → a `MANUAL` activity, linked
   to today's workout in one step
3. **Mark complete** — no data, just status

If Strava isn't connected, option 1 becomes "Connect Strava".

## Interactions

| Action | Behaviour |
|---|---|
| Tap completion circle | `useOptimistic` fills it instantly + tick animation; `POST /api/workouts/:id/complete`; on failure it reverts with a toast and a Retry |
| Long-press card | Context sheet: Complete · Skip · Move to… · Link activity · Add note |
| Swipe strip | Change week, prefetch adjacent weeks |
| Pull to refresh | Re-fetch + trigger a Strava sync if connected and `lastSyncAt` > 5 min |
| Tap `⚡` badge | → `/activities/[id]` |

## States

| State | Behaviour |
|---|---|
| Loading | Skeletons matching the real layout (strip, one card, overview). RSC means this is usually invisible |
| No plan | Redirect to `/onboarding` (handled in middleware) |
| Rest day | Rest card + "Next: Tempo 2-1-1 tomorrow" |
| Future date selected | Card shows the session with a "Scheduled" chip; completion circle hidden |
| Past date, missed | Red "Missed" chip + [Mark complete] / [Skip] / [Move to this week] |
| 3+ missed this week | A realignment banner above Workouts: *"You've missed 3 sessions. Rebuild the rest of your plan around where you are now?"* → preview-changes diff |
| Plan finished | Race-result card: "How did it go?" → log the race, then [Start a new plan] |
| Strava token revoked | Persistent amber banner with [Reconnect] |
| Offline | Cached last view + an offline chip; completion toggles queue and flush on reconnect |

## Desktop

```
┌────────┬───────────────────────────────────────────────┐
│  nav   │  Week 2/12            Fri 16 Oct    [17] 🔔   │
│        │  MON TUE WED THU FRI SAT SUN                  │
│  Today │ ┌─────────────────────┬───────────────────┐   │
│  Plan  │ │ Tempo 2-1-1         │ Week 2 Overview   │   │
│  Cal   │ │ Tempo · 6km         │ ▬▬ ▭▭ ▭▭ ▭▭ ▭▭    │   │
│  Prog  │ │                     │ 1/5 · 6/37.5km    │   │
│  Set   │ │ ── steps ──         ├───────────────────┤   │
│        │ │ Warm up 1.5km easy  │ Insights (stacked)│   │
│        │ │ Run 2km threshold   │ Mileage on track  │   │
│        │ │ Recover 1km easy    │ Monitoring pace   │   │
│        │ │ Run 1km threshold   │ Consistency       │   │
│        │ │ Cool down 0.5km     │                   │   │
│        │ │ [Complete] [Link]   │                   │   │
│        │ └─────────────────────┴───────────────────┘   │
└────────┴───────────────────────────────────────────────┘
```

The extra width is spent **expanding the workout steps inline** — on desktop
there's no reason to make the user navigate to see what the session actually
is. Insights stack vertically instead of scrolling horizontally.
