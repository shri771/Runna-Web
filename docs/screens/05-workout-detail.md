# S5 — Workout Detail

No screenshot — but this is where requirement **#2** lives: *link an activity
through Strava to a specific workout*. It's the most important non-screenshotted
screen in the app.

Route: `/workouts/[id]`

## Layout — scheduled workout

```
┌────────────────────────────────────────────────┐
│ ‹ Back                                   ⋯     │
├────────────────────────────────────────────────┤
│ ▌ TEMPO                                        │  type colour bar
│ ▌ Tempo 2-1-1                                  │
│ ▌ Friday, 16 Oct · Week 2 · BUILD              │
│                                                │
│   6.0 km        40 – 45 m      4:51 /km        │
│   DISTANCE      DURATION       TARGET          │
├────────────────────────────────────────────────┤
│  THE SESSION                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ ① Warm up      1.5 km   5:45 – 6:05 /km  │  │
│  │ ② Run          2.0 km   4:47 – 4:55 /km  │  │
│  │ ③ Recover      1.0 km   5:45 – 6:05 /km  │  │
│  │ ④ Run          1.0 km   4:47 – 4:55 /km  │  │
│  │ ⑤ Cool down    0.5 km   5:45 – 6:05 /km  │  │
│  └──────────────────────────────────────────┘  │
│  ▸ Why this session                            │
│    Threshold work raises the pace you can      │
│    hold before fatigue builds. Run the 2km     │
│    and 1km blocks comfortably hard.            │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐  │
│  │ ⚡ Looks like you ran this                │  │  suggested match
│  │   Morning Run · Fri 16 Oct 06:42          │  │
│  │   6.12 km · 31:48 · 5:12/km               │  │
│  │   [ Yes, link it ]      [ Not this one ]  │  │
│  └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│  [   Mark complete   ]  [  Link activity  ]    │
│  Move to another day · Skip · Add a note       │
└────────────────────────────────────────────────┘
```

## Components

### Header
- Full-bleed type colour bar down the left edge.
- Type label (uppercase 11px), workout name, then
  `Friday, 16 Oct · Week 2 · BUILD`.
- If moved: `↷ Moved from Thu 15 Oct`.
- `⋯` menu: Move · Skip · Swap for a different session · Add note · Delete
  (extras only).

### Stat trio
Distance · duration estimate · the dominant step's target pace. Big tabular
numerals, 11px uppercase labels underneath.

### The session — step list
Rendered from `workouts.steps`. Each row: index, step name, distance (or
duration), and the pace range for its zone resolved against the user's zones.

**Repeat blocks** render nested with a bracket:

```
  ① Warm up        1.5 km    5:45 – 6:05 /km
  ┌ REPEAT ×5 ─────────────────────────────┐
  │ ② Run           400 m    4:22 – 4:28   │
  │ ③ Jog           200 m    6:30 – 7:00   │
  └────────────────────────────────────────┘
  ④ Cool down      1.5 km    5:45 – 6:05 /km
```

An optional **pace bar** visualisation across the top of the list shows the
session's intensity profile — a tiny silhouette of the workout. Cheap to draw
from the step data, and it makes two sessions instantly distinguishable.

### "Why this session"
Collapsed by default. Static copy keyed by `template_id`, so every session the
engine can produce has an explanation. This is what makes the app feel coached
rather than generated.

## Linking an activity — the core flow

### Suggested match
If the auto-matcher scored between 0.45 and 0.75, the suggestion card appears
(see above). Confirming calls the same link endpoint and records
`linked_by = USER`, which is useful signal for tuning thresholds later.

### Manual link
`[ Link activity ]` opens a sheet:

```
┌────────────────────────────────────────────────┐
│  Link an activity            Fri 16 Oct        │
│  ────────────────────────────────────────────  │
│  Morning Run                   Fri 16, 06:42   │
│  6.12 km · 31:48 · 5:12/km          [ Link ]   │
│  ────────────────────────────────────────────  │
│  Lunch Run                     Thu 15, 12:30   │
│  8.04 km · 44:12 · 5:30/km          [ Link ]   │
│  ────────────────────────────────────────────  │
│  Easy shakeout                 Thu 15, 18:10   │
│  4.03 km · 23:55 · 5:56/km          [ Link ]   │
│  ────────────────────────────────────────────  │
│  Show older runs ›                             │
│                                                │
│  [ Sync Strava now ]   [ Enter manually ]      │
└────────────────────────────────────────────────┘
```

- Defaults to unlinked runs within ±7 days, newest first
  (`GET /api/activities?unlinked=true&around=&window=7`).
- Each row shows date/time, distance, moving time, average pace, and a source
  icon (Strava orange or a pencil for manual).
- Rows close to the planned distance are subtly highlighted.
- **Sync Strava now** forces a pull for a run that was just uploaded.
- **Enter manually** inlines a three-field form (distance, duration, date) and
  links the result in one step — the fallback that keeps the screen useful with
  no integration at all.

### Conflicts
If the chosen activity is already linked elsewhere, the server returns `409
ACTIVITY_ALREADY_LINKED` with the conflicting workout, and the sheet offers:

```
┌────────────────────────────────────────────────┐
│  Already linked                                │
│  "Morning Run" is linked to 5km Easy Run       │
│  on Sat 17 Oct.                                │
│                                                │
│  [ Cancel ]   [ Move it to this workout ]      │
└────────────────────────────────────────────────┘
```

Moving unlinks the old workout (back to `SCHEDULED`) and links the new one in
one transaction.

### Not connected
If there is no Strava connection, `[ Link activity ]` becomes
`[ Connect Strava ]`, routing to `/settings/connections?next=/workouts/[id]` so
the user comes straight back.

## Layout — completed workout

Once linked, the screen becomes a comparison of planned vs actual.

```
┌────────────────────────────────────────────────┐
│ ‹ Back                                   ⋯     │
├────────────────────────────────────────────────┤
│ ▌ TEMPO · ✓ COMPLETED            [ NAILED IT ] │
│ ▌ Tempo 2-1-1                                  │
│ ▌ Friday, 16 Oct                               │
├────────────────────────────────────────────────┤
│              PLANNED        ACTUAL             │
│  Distance    6.00 km        6.12 km    +2%     │
│  Duration    40 – 45 m      31:48              │
│  Avg pace    4:51 /km       5:12 /km   ⚠ slow  │
├────────────────────────────────────────────────┤
│  ▁▃▇▇▇▃▁▃▇▇▃▁    pace over distance            │
│  target zone shaded behind the trace           │
├────────────────────────────────────────────────┤
│  HOW IT WENT                                   │
│  ① Warm up    1.5km   planned 5:45–6:05  ✓     │
│  ② Run        2.0km   planned 4:47–4:55  ⚠ +9s │
│  ③ Recover    1.0km   planned 5:45–6:05  ✓     │
│  ④ Run        1.0km   planned 4:47–4:55  ✓     │
│  ⑤ Cool down  0.5km   planned 5:45–6:05  ✓     │
├────────────────────────────────────────────────┤
│  ⚡ Morning Run · Strava            View ›      │
│  Linked automatically · 0.91 confidence         │
│  [ Unlink ]                                     │
├────────────────────────────────────────────────┤
│  How did it feel?   😣 😕 🙂 😀 💪              │
│  Notes…                                         │
└────────────────────────────────────────────────┘
```

- **Compliance pill** — `NAILED IT` / `CLOSE` / `OFF TARGET` in brand / yellow /
  muted.
- **Per-step analysis** where Strava returned laps: each planned `RUN` step is
  aligned to its lap and marked on-target, fast or slow. For `Pyramid
  Intervals` this becomes a rep-by-rep readout, which is the single most
  coach-like thing in the product.
- **Pace trace** from the activity's streams, with the target zone shaded
  behind it.
- **Provenance** — the app always says whether a link was automatic or manual,
  and with what confidence. Unlink is always one tap away.
- **RPE + notes** — subjective feedback, stored on the workout, surfaced in
  Progress.

## States

| State | Behaviour |
|---|---|
| Loading | Skeleton header + 5 step rows |
| Not found / not owned | 404 page with [Back to calendar] |
| Scheduled, future | Full session, Complete/Link hidden behind "Log it early?" |
| Scheduled, today | Default layout above |
| Missed (past, incomplete) | Red "Missed" chip + [Mark complete] / [Skip] / [Move to this week] |
| Skipped | Muted, with [Undo skip] |
| Rest day | Rest card, no steps, next session named |
| No activities to link | Empty state: "No unlinked runs near 16 Oct" + [Sync Strava] / [Enter manually] / [Show older] |
| Strava revoked mid-session | Picker shows a reconnect banner; manual entry still works |
| Link failed (409) | Conflict sheet above |
| Link failed (network) | Row reverts, toast + Retry |
| Activity deleted in Strava | Webhook unlinks it; workout returns to `SCHEDULED` with a notification |

## Desktop

Two columns: the session breakdown on the left, and on the right the activity
panel — map (from the polyline), splits table, HR if present — plus the action
buttons. The link picker becomes a centred dialog rather than a bottom sheet.
