# S4 — Calendar

> Reference: `docs/example-layout/WhatsApp Image 2026-10-17 at 00.03.21.jpeg`

The schedule, and the place where workouts get **rearranged**. This is the
second half of workflow **W2**.

## Mobile layout

```
┌────────────────────────────────────────────────┐
│ (◔)          Calendar              [17]  💡    │
├────────────────────────────────────────────────┤
│  13                                            │  ← prev week tail
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ WED │┬───────────────┐                     ┃ │  current week
│ ┃  14 │││5.5km Easy Run │                    ┃ │  outlined
│ ┃     │││5.5km          │                    ┃ │
│ ┃─────┴┴───────────────┴─────────────────────┃ │
│ ┃ THU ││Pyramid Intervals│                   ┃ │
│ ┃  15 ││8km              │                   ┃ │
│ ┃─────┴┴─────────────────┴───────────────────┃ │
│ ┃ FRI ││Tempo 2-1-1 │                        ┃ │
│ ┃  16 ││6km         │                        ┃ │
│ ┃─────┴┴────────────┴────────────────────────┃ │
│ ┃ SAT ││5km Easy Run│ │Progressive Mile Reps│┃ │  2 per day
│ ┃ (17)││5km         │ │10km              ⚡ │┃ │
│ ┃─────┴┴────────────┴─┴─────────────────────┴┃ │
│ ┃ SUN ││13km Long Run│      + Add            ┃ │
│ ┃  18 ││13km         │                       ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                │
│  Oct 19 - Oct 25   (WEEK 3)                    │  week header
│  Total: 40.4 km                                │
│  MON │ │6.5km Easy Run│        + Add           │
│   19 │ │6.5km         │                        │
│  TUE │        + Add                            │
│   20 │                                         │
│  WED │ │Tempo 2km Repeats│     + Add           │
│   21 │ │7.5km            │                     │
├────────────────────────────────────────────────┤
│  Today   Plan   Calendar   Link   Progress     │
└────────────────────────────────────────────────┘
```

## Structure

An **infinite vertical agenda**, grouped by week, not a month grid. Rationale:
a runner's unit of thought is the week, weekly totals are the thing they check,
and drag targets are far larger in a list than in a 7×5 grid.

### Week header
```
Oct 19 - Oct 25   [WEEK 3]
Total: 40.4 km
```
- Date range, a week-number pill, and the week's **total planned distance**.
- Once the week has activity, a second line: `Done: 22.4 km · 3/5`.
- Phase chip on the right (`BASE` / `BUILD` / `PEAK` / `TAPER`), colour-coded.
- The **current week block is outlined** in `--text` at 1px, exactly as in the
  screenshot — it's the only visual anchor in a long scroll.

### Day row
- Left gutter, 56px: weekday abbreviation over the date.
  - Today → white filled circle
  - Past days with an incomplete workout → `--danger` red
  - Rest days → muted, no chip
- Right: a horizontally scrolling row of `<WorkoutChip>`s. Multiple workouts per
  day are supported — the Saturday in the screenshot has two.
- A `+ Add` affordance at the end of every day's row.

### Workout chip
4px type-colour bar, title, distance, and a status slot on the right:
`⚡` linked to an activity · `✓` completed manually · `↷` moved from another
day · `★` user-added extra.

### Header actions
- **`[17]` date chip** — jump back to today, from anywhere in the scroll.
- **💡 lightbulb** — opens a legend sheet: what each colour means, what each
  workout type is for, and how rearranging works. The screenshot has this icon
  and it's a cheap way to make a dense screen self-explanatory.

## Rearranging — drag and drop

The headline interaction on this screen. `dnd-kit`, with a keyboard path.

```
press & hold chip (150ms)
   → chip lifts: scale .98, shadow, 80% opacity
   → valid drop days get a dashed --brand outline
   → invalid days dim to 40%
   → drag over a day → it expands 8px to receive
   → release
      ├─ valid     → spring into place, week totals animate, toast + [Undo]
      ├─ warning   → sheet: "Two hard sessions back to back." [Move anyway] [Cancel]
      └─ invalid   → chip springs back, toast explains why
```

**Validity** comes from `POST /api/workouts/:id/move` (04-plan-engine §11):

| Rule | Outcome |
|---|---|
| Within ±7 days of the planned date | hard requirement |
| Not more than 1 day into the past | hard requirement |
| Not after the race date | hard requirement |
| Max 3 workouts on one day | hard requirement |
| Two quality sessions on consecutive days | warning, overridable |
| Quality the day before the long run | warning, overridable |

Optimistic: the chip moves immediately via `useOptimistic` and the week totals
recompute client-side. A server rejection animates it back and explains why.

**Keyboard:** `Tab` to a chip, `Space` to lift, `↑`/`↓` to move between days,
`Space` to drop, `Esc` to cancel. Live-region announcements at each step.

Moved workouts keep `moved_from_date` and show `↷`, with "Moved from Thu 15 Oct"
on the detail screen — the plan stays honest about what was changed.

## `+ Add` — adding an extra workout

Opens a sheet:

```
┌──────────────────────────────────────┐
│  Add a workout — Tue 20 Oct          │
│                                      │
│  ○ Easy run        ○ Recovery run    │
│  ○ Long run        ○ Tempo           │
│  ○ Intervals       ○ Cross-training  │
│                                      │
│  Distance   ├────●──────┤   8 km     │
│                                      │
│  ⚠ Adds 8km to a 40.4km week (+20%)  │
│                                      │
│         [Cancel]        [Add]        │
└──────────────────────────────────────┘
```

Extras are built from the same templates with the same pace zones, flagged
`is_extra = true`. They count toward *actual* volume but not *plan adherence* —
otherwise adding runs would inflate the completion percentage.

## Other interactions

| Action | Behaviour |
|---|---|
| Tap chip | → `/workouts/[id]` |
| Long-press chip | Sheet: Complete · Skip · Move to… · Link activity · Swap type · Delete (extras only) |
| Scroll up/down | Infinite in both directions, 6 weeks per page |
| Tap week header | Collapse/expand that week |
| Pull to refresh | Re-fetch + Strava sync if stale |

## States

| State | Behaviour |
|---|---|
| Loading | Three skeleton week blocks |
| Loading more | Inline spinner at the scroll edge |
| Before plan start | Grey "Your plan starts Mon 13 Oct" divider; earlier scrolling stops |
| After race day | "Race day 🏁" chip, then a "Plan complete" end card |
| Rest day | Muted "Rest" label in the day row, `+ Add` still available |
| Empty week (paused plan) | "Plan paused" placeholder + [Resume] |
| Move rejected | Chip springs back, toast with the specific reason and the valid window |
| Move failed (network) | Reverts, "Couldn't move that — check your connection" + Retry |
| Offline | Cached weeks render; drag is disabled with an explanatory chip rather than silently failing |

## Desktop

At ≥1024px a view toggle appears: **Agenda | Month**.

- **Agenda** stays the default — same list, wider chips showing the pace target
  inline (`Tempo 2-1-1 · 6km · 4:51/km`).
- **Month** renders a 7-column grid, one cell per day with stacked mini-chips
  and the weekly total in a right-hand gutter column. Drag-and-drop works
  across the grid, which is where a month view earns its place: moving a
  session across two weeks is one gesture instead of a long scroll.

A details pane can be pinned to the right so clicking a chip shows the full
workout without leaving the calendar.
