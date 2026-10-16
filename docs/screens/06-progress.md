# S6 — Progress

> Reference: `docs/example-layout/WhatsApp Image 2026-10-17 at 00.03.25.jpeg`

Workflow **W5**: see overall progress. Two tabs — what you *did* (Workouts) and
how it's *trending* (Performance).

## Mobile layout — Performance tab

```
┌────────────────────────────────────────────────┐
│ (◔)          Progress                +    🔔   │
├────────────────────────────────────────────────┤
│   Workouts          │      Performance         │  tabs
│ ────────────────────┴══════════════════════════│
├────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐ │
│ │ Oct 12 - Oct 19        VIEW BY: WEEK ▾     │ │
│ │                                            │ │
│ │ KILOMETERS    TIME      ACTIVITIES         │ │
│ │ 0.00          0s        0                  │ │
│ │                                            │ │
│ │  ┊    ┊  █ ┊  █ ┊    ┊    ┊    ┊     29    │ │
│ │  ┊    ┊  █ ┊  █ ┊    ┊  █ ┊    ┊           │ │
│ │ ─┊────┊──█─┊──█─┊────┊──█─┊──█─┊─── 14.5   │ │
│ │  ┊    ┊  █ ┊  █ ┊  █ ┊  █ ┊  █ ┊           │ │
│ │  24 Aug31 Sep7 Sep14 Sep21 Sep28 Oct5  0.0 │ │
│ └────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  Personal Records                              │
│ ┌────────────────────────────────────────────┐ │
│ │   ⬡1K       ⬡1MI      ⬡2MI                 │ │
│ │   1K        1MI       2MI                  │ │
│ │   3m 45s    6m 10s    16m 39s              │ │
│ │   Aug 23    Aug 23    Aug 23               │ │
│ │                                            │ │
│ │   ⬡5K       ⬡5MI      ⬡10K                 │ │
│ │   5K        5MI       10K                  │ │
│ └────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  Today   Plan   Calendar  Progress  Settings   │
└────────────────────────────────────────────────┘
```

## Header
- `+` — log a manual activity (distance, duration, date) without going through
  a workout. Creates a `MANUAL` activity; the matcher then offers to link it.
- Bell → notifications. Dot when there's an unseen PR.

## Performance tab

### Range card
- **Period label** — `Oct 12 - Oct 19`, driven by the selected range.
- **`VIEW BY: WEEK ▾`** — Week / Month / Year. Changes both the bucket size of
  the chart and the span of the totals. Persisted in `?range=`.
- **Three totals**: `KILOMETERS`, `TIME`, `ACTIVITIES`, in the 11px uppercase
  label style over display-size numerals. Unit label follows the user's
  preference (`MILES` when set to imperial).
- A delta chip against the previous period: `−22.8% vs last week`, green when
  up, muted when down. Not red — a down week during a taper is correct, and the
  UI shouldn't scold the user for following the plan.

### Chart
Recharts bar chart, one bar per bucket.

- Right-hand y-axis with three ticks (`0.0`, mid, max) and a solid mid gridline,
  matching the screenshot.
- Dashed vertical separators between buckets.
- Bars `--surface-3`; the current/selected bucket `--brand`.
- Tap a bar → that bucket becomes the selected period and the totals above
  update.
- Long-press → tooltip with the exact figures.
- Toggle: **Actual only** / **Actual vs planned** — the second overlays the
  plan's target line, which turns this chart from a log into an adherence view.
- Horizontally scrollable with 8 buckets visible by default.

### Personal Records
A 3-column grid of hexagonal `<PRBadge>`s.

- 13 distances: `400m, ½ mile, 1K, 1 mile, 2 mile, 5K, 5 mile, 10K, 15K,
  10 mile, 20K, Half, Marathon`. The screenshot shows the first six.
- **Achieved**: coloured per the tier palette in
  [03 — Design System](../03-design-system.md), with time and the date set.
- **Locked**: 25% opacity greyscale, distance label only. New users see the
  shape of what's possible instead of an empty box.
- **New**: a `--brand` ring + "NEW" ribbon until viewed, driven by
  `personal_records.seen`.
- Tap → `/activities/[id]` for the run that set it.
- Long-press → a sparkline of that distance's PR history over time.

PRs come from Strava's `best_efforts` on each activity, with a stream-scan
fallback — see [05 — Strava Integration §8](../05-strava-integration.md).

## Workouts tab

The qualitative half: what was actually run against what was planned.

```
┌────────────────────────────────────────────────┐
│  Filter: All ▾   Compliance: All ▾             │
├────────────────────────────────────────────────┤
│  THIS WEEK                            3/5      │
│ ┌────────────────────────────────────────────┐ │
│ │▌Tempo 2-1-1           Fri 16  [NAILED IT]  │ │
│ │ 6.12km · 31:48 · 5:12/km              ⚡   │ │
│ ├────────────────────────────────────────────┤ │
│ │▌5.5km Easy Run        Wed 14  [CLOSE]      │ │
│ │ 5.48km · 32:10 · 5:52/km              ⚡   │ │
│ ├────────────────────────────────────────────┤ │
│ │▌Pyramid Intervals     Thu 15  [MISSED]     │ │
│ └────────────────────────────────────────────┘ │
│  LAST WEEK                            5/5      │
│  …                                             │
├────────────────────────────────────────────────┤
│  Summary                                       │
│  Adherence 82% · 31 of 38 sessions             │
│  NAILED 19 · CLOSE 9 · OFF 3                   │
└────────────────────────────────────────────────┘
```

- Grouped by week, newest first, infinite scroll.
- Filters: workout type, compliance grade, linked/unlinked, date range.
- Each row → `/workouts/[id]`.
- A running summary at the bottom: adherence percentage and the compliance
  distribution.

This tab is what distinguishes the app from Strava itself: Strava knows what
you ran, this knows what you were *supposed* to run.

## Data

Everything is served from `weekly_rollups` (06-data-model), recomputed lazily
when a row is missing. Year view aggregates 52 rows rather than scanning
thousands of activities, which keeps the page fast on the Neon free tier.

## States

| State | Behaviour |
|---|---|
| Loading | Skeleton stat row + chart shimmer + 6 ghost hexagons |
| No activities at all | Empty state: "No runs yet. Connect Strava to import your history, or log a run manually." + both buttons. The PR grid still renders, fully locked |
| Strava not connected | Dismissible banner above the chart |
| Range with zero data | Chart renders with zero bars (as in the screenshot, which shows a 0.00 week) and the message "Nothing logged this week yet" — **not** an empty state. A zero week is information |
| Partial history | Chart starts at the first activity, no fake leading zeros |
| New PR | Badge ringed + "NEW", tab icon dotted, notification created |
| Rollup recompute | Stale-while-revalidate: show the cached figure, refresh underneath |
| Load more failed | Inline retry at the scroll edge, existing rows preserved |

## Desktop

Tabs become a left-aligned segmented control. Two-column grid: the chart card
spans both columns, then Personal Records fills the left column as a 4-up grid
while a **Training load** panel occupies the right — weekly distance, average
pace trend, and completion rate over the last 12 weeks. The Workouts tab gains
a sortable table layout (date, workout, planned, actual, pace, compliance)
rather than stacked cards.
