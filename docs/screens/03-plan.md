# S3 — Plan

> Reference: `docs/example-layout/WhatsApp Image 2026-10-17 at 00.03.30.jpeg`

The zoomed-out view: the shape of the whole training block, and the entry point
to every customisation. This is workflow **W2** and half of **W5**.

## Mobile layout

```
┌────────────────────────────────────────────────┐
│ (◔)          Your Plan                    🔔   │
├────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐ │
│ │  Half Marathon Plan              ⬡         │ │  hero
│ │  Your race: DEC 27, 2026        21.1       │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │   (i)      (📅)      (⊞)       (📋)        │ │  quick actions
│ │  Plan   Rearrange  Connected  Manage       │ │
│ │  Guide  Workouts     Apps      Plan        │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │  Plan overview                           › │ │
│ │     ▃▆▆▄▇▇█▅██▇▆▆                 56km     │ │
│ │                                   28km     │ │
│ │  1 2 3 4 5 6 7 8 9 10 11 12        0km     │ │
│ │ ──────────────────────────────────────────  │ │
│ │ (◔) Week 2                               › │ │
│ │     0/5 workouts                           │ │
│ │ ──────────────────────────────────────────  │ │
│ │ (◔) Plan distance                        › │ │
│ │     11/453km                               │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │  PACE INSIGHTS                           › │ │
│ └────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  Today   Plan   Calendar   Link   Progress     │
└────────────────────────────────────────────────┘
```

## Components

### Hero card
- Plan name (`Half Marathon Plan`) and, if set, the race name.
- `Your race: DEC 27, 2026` in `--brand`, with a countdown chip (`71 days`).
- A **distance shield badge** on the right — hexagonal, `21.1`, coloured per
  goal (5K teal, 10K blue, Half red, Marathon gold, Build-mileage slate).
- Tap → `/plan/manage`.

### Quick actions — four circular icon buttons

| Action | Destination | What it does |
|---|---|---|
| **Plan Guide** | `/plan/guide` | Explains every workout type in this plan, what the phases mean, how to read pace ranges. Content generated from the plan's own templates, so it only describes sessions the user will actually see. |
| **Rearrange Workouts** | `/plan/rearrange` | Bulk schedule editor (below) |
| **Connected Apps** | `/settings/connections` | Strava connect/status |
| **Manage Plan** | `/plan/manage` | All the customisation knobs |

### Plan overview chart
One bar per plan week, `target_distance_m` on the y-axis.

- Completed weeks: solid `--brand`.
- Current week: `--brand` with a bold week number beneath.
- Future weeks: `--brand-dim`.
- Cutback and taper weeks are visibly shorter — the user can *see* the
  periodisation, which is the point.
- Tapping a bar → `/plan/week/[n]`.
- An optional overlay line of **actual** weekly distance versus planned, toggled
  by a "Show actual" switch. This is where plan-vs-reality becomes obvious.

### Stat rows
`<StatRow>` with an SVG ring:

- **Week 2 — 0/5 workouts** → `/plan/week/2`
- **Plan distance — 11/453km** → `/progress`
- A third row appears once there's data: **Adherence — 82%** (completed ÷
  scheduled to date).

### Pace insights
Expands to show the user's training zones and how actual paces compare:

```
             TARGET          YOUR AVERAGE
Easy      5:45 – 6:05/km     5:38/km   ⚠ slightly fast
Long      5:40 – 6:15/km     5:52/km   ✓
Threshold 4:47 – 4:55/km     4:51/km   ✓
Intervals 4:22 – 4:28/km     4:19/km   ✓
```

Running easy runs too fast is the most common amateur mistake, so flagging it
is genuinely useful coaching rather than a vanity stat. Computed from linked
activities grouped by the dominant zone of their workout.

## `/plan/manage` — Manage Plan

Where the plan actually gets customised. Grouped sections, each editable:

| Section | Fields |
|---|---|
| **Race** | Race name, race date, goal type |
| **Schedule** | Days per week, which days, long run day |
| **Volume** | Target weekly distance, progression rate |
| **Limits** | Max easy / long / hard run distance |
| **Fitness** | Ability, pace basis (recent race result) |
| **Danger zone** | Pause plan · Restart plan · Archive plan |

Nothing writes on change. Edits accumulate, and a sticky bar appears:

```
┌────────────────────────────────────────────────┐
│  3 changes        [Discard]   [Preview changes]│
└────────────────────────────────────────────────┘
```

**Preview changes** → `POST /api/plans/:id/preview-changes` → a diff sheet:

```
┌────────────────────────────────────────────────┐
│  Review changes                                │
│                                                │
│  Target weekly    45km  →  32km                │
│  Progression    Steady  →  Gradual             │
│                                                │
│  Weeks 3–12 will change                        │
│  41 workouts updated · 2 removed               │
│  Peak week      45km  →  32km                  │
│  Total distance 453km →  371km                 │
│                                                │
│     ▃▆▆▄▇▇█▅██▇▆     →     ▃▄▄▃▅▅▆▄▆▆▅▄        │
│                                                │
│  Weeks 1–2 are complete and won't change.      │
│                                                │
│            [Cancel]      [Apply changes]       │
└────────────────────────────────────────────────┘
```

Apply → `POST /api/plans/:id/regenerate` → new `PlanVersion`, and a toast with
**[Undo]** for 24 hours.

Showing the before/after curve side by side is what makes this feel like
software rather than a form. It's also the clearest thing to put in the demo
video.

## `/plan/rearrange` — bulk schedule editor

The Calendar handles one-off drags. This handles *permanent* pattern changes.

```
┌────────────────────────────────────────────────┐
│  Rearrange workouts                            │
│  Changes apply to all remaining weeks.         │
├────────────────────────────────────────────────┤
│         MON  TUE  WED  THU  FRI  SAT  SUN      │
│  Easy    ○    ●    ○    ●    ○    ●    ○       │
│  Quality ○    ●    ○    ○    ●    ○    ○       │
│  Long    ○    ○    ○    ○    ○    ○    ●       │
├────────────────────────────────────────────────┤
│  ⚠ Tuesday has an easy run and a quality       │
│    session. That's allowed but heavy.          │
├────────────────────────────────────────────────┤
│  [Reset]                    [Preview changes]  │
└────────────────────────────────────────────────┘
```

Live validation against the engine's placement rules (04-plan-engine §8) as the
user toggles, then the same diff-preview-then-commit flow.

## States

| State | Behaviour |
|---|---|
| Loading | Skeleton hero + chart shimmer |
| No plan | Middleware redirects to `/onboarding` |
| Plan paused | Grey banner "Plan paused since 12 Oct" + [Resume] |
| Plan complete | Hero becomes a summary: total distance, workouts completed, PRs set, adherence + [Start a new plan] |
| Race in the past, unlogged | "Did you race on 27 Dec?" → log result → plan completes |
| Regeneration in flight | Diff sheet shows a progress state; apply button disabled |
| Regeneration failed | Error with reason, nothing written (single transaction), Retry |
| Settings change makes the plan invalid | Blocking issues shown in the diff sheet; Apply disabled with the reason |

## Desktop

Three-column grid at ≥1024px: hero spans the full width; quick actions become a
horizontal row of labelled buttons; the plan overview chart takes two columns
with the stat rows and pace insights stacked in the third. Manage Plan becomes
a two-pane layout — sections on the left, live diff preview pinned on the
right, so the user sees the consequence of each edit as they make it.
