# 04 — Plan Engine

This is the centre of the product. Everything else is a view over what this
produces. It lives in `src/lib/plan-engine/` as **pure TypeScript** — no
database, no React, no network — which makes it trivially unit-testable and
keeps the interesting logic out of the framework.

```
src/lib/plan-engine/
  types.ts         PlanRequest, Plan, Workout, WorkoutStep, PaceZones
  validate.ts      input guards → PlanIssue[]
  paces.ts         Riegel equivalence + training pace zones
  phases.ts        base / build / peak / taper timeline
  mileage.ts       weekly volume curve, cutbacks, taper
  longrun.ts       long-run progression curve
  schedule.ts      which day gets which session type
  templates/       parameterised workout builders
  materialise.ts   session slots → Workout[] with steps
  generate.ts      the pipeline entry point
  regenerate.ts    non-destructive re-planning
  index.ts
```

## 1. Input

```ts
type PlanRequest = {
  goal: 'FIVE_K' | 'TEN_K' | 'HALF' | 'MARATHON' | 'BUILD_MILEAGE'
  raceDate?: ISODate          // required unless BUILD_MILEAGE
  planWeeks?: number          // required for BUILD_MILEAGE (4–52)
  startDate: ISODate          // defaults to next Monday

  daysPerWeek: 2 | 3 | 4 | 5 | 6 | 7
  preferredDays: Weekday[]    // length >= daysPerWeek
  longRunDay: Weekday

  ability: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  currentWeeklyKm: number
  currentLongestKm: number

  // the customisation the user cares most about
  targetWeeklyKm?: number     // hard ceiling on peak volume
  progression: 'GRADUAL' | 'STEADY' | 'AGGRESSIVE'
  maxEasyKm?: number
  maxLongKm?: number
  maxHardKm?: number

  paceBasis:
    | { kind: 'RACE_RESULT'; distanceM: number; timeS: number }
    | { kind: 'ESTIMATED_5K'; timeS: number }
    | { kind: 'EASY_PACE'; secPerKm: number }

  units: 'KM' | 'MI'
}
```

## 2. Pipeline

```
PlanRequest
   │
   ├─▶ validate()            → PlanIssue[]  (blocking errors + warnings)
   ├─▶ derivePaceZones()     → PaceZones
   ├─▶ buildPhases()         → Phase[]
   ├─▶ buildMileageCurve()   → km per week
   ├─▶ buildLongRunCurve()   → km per week
   ├─▶ assignSessionSlots()  → SessionSlot[][]  (week × day)
   ├─▶ materialise()         → Workout[] with nested steps + pace targets
   └─▶ balanceToTarget()     → distribute remainder across easy runs
   │
   ▼
 Plan  { weeks: PlanWeek[], workouts: Workout[], totalKm, peakKm }
```

Deterministic: the same `PlanRequest` always yields byte-identical output. No
randomness, no clock reads inside the engine (dates come from `startDate`).
That makes snapshot testing possible and makes regeneration predictable.

## 3. `validate()` — the guard rails

Returns issues rather than throwing, so the wizard can show all problems at once
and distinguish blockers from advice. This is where most of the app's input
error handling lives.

| Code | Severity | Rule |
|---|---|---|
| `RACE_DATE_PAST` | error | Race date must be in the future |
| `PLAN_TOO_SHORT` | error | Weeks available < minimum for goal (5K:4, 10K:6, Half:8, Marathon:12) |
| `PLAN_TOO_LONG` | error | > 52 weeks |
| `TOO_FEW_DAYS` | error | `daysPerWeek < 2`, or quality + long run won't fit |
| `PREFERRED_DAYS_MISMATCH` | error | `preferredDays.length < daysPerWeek` |
| `LONG_RUN_DAY_NOT_AVAILABLE` | error | `longRunDay` not in `preferredDays` |
| `LONGEST_EXCEEDS_WEEKLY` | error | `currentLongestKm > currentWeeklyKm` |
| `TARGET_BELOW_CURRENT` | error | `targetWeeklyKm < currentWeeklyKm` |
| `RAMP_TOO_STEEP` | **warning** | Reaching target needs > 10%/week — offer to extend the plan, lower the target, or accept the risk |
| `TARGET_TOO_LOW_FOR_GOAL` | **warning** | `targetWeeklyKm < raceDistance × 1.5` for Half/Marathon |
| `LONG_RUN_GAP` | **warning** | `currentLongestKm < 30%` of race distance — base phase auto-extends |
| `NO_PACE_BASIS` | **warning** | Falls back to ability-level default paces, flagged as estimates |

The 10%/week ceiling is the standard injury-avoidance heuristic and is the
single most important rule in the engine. A warning, not an error — the user
can override, but they're told.

## 4. `derivePaceZones()`

Everything is computed from one number: an **equivalent 5K time** in seconds.

**Step 1 — normalise the pace basis to a 5K equivalent** using Riegel's formula:

```
T2 = T1 × (D2 / D1) ^ 1.06
```

So a 50:00 10K → `3000 × (5000/10000)^1.06` ≈ **1437s ≈ 23:57** for 5K.
For `EASY_PACE`, invert the easy offset below. For `ESTIMATED_5K`, use directly.

**Step 2 — offsets from 5K pace.** With `p5k` = seconds per km:

| Zone | Pace range (s/km) | Used by |
|---|---|---|
| `INTERVAL` | `p5k − 8` … `p5k − 2` | 400–1200m reps |
| `FIVE_K` | `p5k − 3` … `p5k + 3` | short reps, race |
| `TEN_K` | `p5k + 8` … `p5k + 14` | mile repeats, cruise |
| `THRESHOLD` | `p5k + 17` … `p5k + 25` | tempo blocks |
| `MARATHON` | `p5k + 35` … `p5k + 45` | race-pace long runs |
| `LONG` | `p5k + 70` … `p5k + 95` | long runs |
| `EASY` | `p5k + 75` … `p5k + 95` | easy runs |
| `RECOVERY` | `p5k + 100` … `p5k + 125` | recovery shakeouts |

Every zone is a **range**, never a single number — that's what produces the
`40m – 45m` duration estimate on the Today card and keeps targets realistic.

**Step 3 — sanity clamps.** No zone may be faster than `150 s/km` (2:30/km) or
slower than `600 s/km` (10:00/km); zones must stay monotonically ordered. Garbage
input (a 9-minute 5K) gets clamped and flagged rather than producing nonsense.

**Step 4 — ability defaults** when there is no pace basis: beginner `p5k = 390`,
intermediate `330`, advanced `270`.

## 5. `buildPhases()`

Classic periodisation. Proportions of total weeks, floored, with the remainder
going to Base:

| Phase | Share | Purpose |
|---|---|---|
| `BASE` | 35% | Aerobic volume, strides, light fartlek |
| `BUILD` | 30% | Tempo and threshold work |
| `PEAK` | 20% | VO2max intervals, race-pace long runs |
| `TAPER` | 15% (min 1 wk, max 3) | Volume down, intensity retained |

Taper length is forced by goal: 5K → 1 week, 10K → 1, Half → 2, Marathon → 3.
If `LONG_RUN_GAP` was warned, Base borrows one week from Build.

## 6. `buildMileageCurve()` — the customisation hot path

This is what changes when the user edits **expected weekly mileage**.

```
rate = { GRADUAL: 0.04, STEADY: 0.07, AGGRESSIVE: 0.10 }[progression]
peak = targetWeeklyKm ?? currentWeeklyKm × (1 + rate) ^ buildWeeks

for each week i in BASE..PEAK:
    raw      = previous × (1 + rate)
    capped   = min(raw, peak)
    cutback  = isCutbackWeek(i) ? capped × 0.75 : capped
    week[i]  = round(cutback, 0.5)

cutback cadence: every 4th week (every 3rd for BEGINNER)
                 never the final week before taper

for each week j in TAPER (n weeks):
    week[j] = peak × taperCurve[n][j]      // e.g. 3-week: [.75, .55, .40]
race week:   raceDistance + 2 short shakeouts
```

Two properties that matter:

1. **The target is a ceiling, not a destination.** If the user sets 32 km and
   the curve would reach 45, it plateaus at 32 and the extra weeks become
   quality-focused rather than volume-focused.
2. **Cutback weeks are visible.** The dips at weeks 4, 8 and the taper at 11–12
   are exactly what the Plan Overview bar chart in the screenshot shows. Users
   read the shape of their block from this chart, so the curve has to look
   right as well as be right.

## 7. `buildLongRunCurve()`

```
longRun[i] = min(
   currentLongestKm + (i × longRunStepKm),
   maxLongKm ?? goalCeiling,
   weeklyKm[i] × 0.40          // never more than 40% of the week
)
```

`goalCeiling`: 5K → 10km, 10K → 14km, Half → 19km, Marathon → 32km.
Long runs also take a cutback on cutback weeks (×0.8), and in the taper they
fall to 60% / 45% / 30% of peak.

## 8. `assignSessionSlots()`

First decide the **mix** for the week, then place it on days.

| Days/wk | Session mix |
|---|---|
| 2 | Long + 1 Quality |
| 3 | Long + 1 Quality + 1 Easy |
| 4 | Long + 1 Quality + 2 Easy |
| 5 | Long + 2 Quality + 2 Easy |
| 6 | Long + 2 Quality + 3 Easy |
| 7 | Long + 2 Quality + 3 Easy + 1 Recovery |

Quality session type rotates by phase:

| Phase | Quality pool |
|---|---|
| `BASE` | Strides, Easy Fartlek, Short Tempo |
| `BUILD` | Tempo 2-1-1, Threshold Repeats, Progressive Run |
| `PEAK` | Pyramid Intervals, Mile Repeats, Race-Pace Long Run |
| `TAPER` | Shortened Peak sessions (same shape, ~60% volume) |

**Placement rules**, applied in order:

1. Long run on `longRunDay`.
2. Quality sessions never on consecutive days.
3. Quality never the day before the long run.
4. Maximum separation between the two quality sessions (e.g. Tue + Fri).
5. Rest day immediately after the hardest session where days allow.
6. Only ever use days in `preferredDays`.

Implemented as a small constraint solver: generate candidate placements, score
each against rules 2–5, take the best. With ≤7 days the search space is tiny,
so brute force is fine and the result is deterministic.

## 9. `materialise()` — building actual workouts

A `Workout` holds **structured steps** with nested repeat blocks:

```ts
type WorkoutStep =
  | { kind: 'WARMUP' | 'COOLDOWN' | 'RUN' | 'RECOVERY'
      distanceM?: number; durationS?: number; zone: PaceZone }
  | { kind: 'REPEAT'; count: number; children: WorkoutStep[] }
```

### Template examples

**`tempo_2_1_1`** — the `Tempo 2-1-1` in the Today screenshot:
```
WARMUP    1.5km  EASY
RUN       2.0km  THRESHOLD
RECOVERY  1.0km  EASY
RUN       1.0km  THRESHOLD
COOLDOWN  0.5km  EASY
                               total 6.0km · est. 40–45m
```

**`pyramid_intervals`** — the 8km session on Thu 15:
```
WARMUP    1.5km  EASY
REPEAT ×1
  RUN 400m INTERVAL   / RECOVERY 200m RECOVERY
  RUN 800m INTERVAL   / RECOVERY 400m RECOVERY
  RUN 1200m INTERVAL  / RECOVERY 400m RECOVERY
  RUN 800m INTERVAL   / RECOVERY 400m RECOVERY
  RUN 400m INTERVAL
COOLDOWN  1.5km  EASY
                               total ~8.0km
```

**`progressive_mile_repeats`**, **`threshold_2km_repeats`**, **`easy_run`**,
**`long_run`**, **`race_pace_long`**, **`recovery_run`**, **`strides`**,
**`fartlek`**, **`race_day`** complete the library. Roughly 11 templates.

Each template is a function:
```ts
(ctx: { targetKm: number; phase: Phase; zones: PaceZones; weekIndex: number })
  => { name: string; type: WorkoutType; steps: WorkoutStep[]; totalM: number }
```
so a template scales to the volume it's handed instead of being hardcoded.

### Duration estimate
Sum each step's `distanceM / paceRange` to produce a min and max, round to the
nearest 5 minutes, render as `40m – 45m`.

### `balanceToTarget()`
Long run and quality sessions are fixed first. Whatever remains of the week's
target km is spread across the easy runs, respecting `maxEasyKm` and a 3km
floor. Residual under 0.5km is absorbed by the longest easy run.

## 10. `regenerate()` — non-destructive re-planning

The hard part, and the reason plans are versioned.

**Trigger points:** target mileage changed · days per week changed · preferred
days or long-run day changed · race date moved · progression changed · user
accepts a realignment prompt after missing sessions.

```
regenerate(plan, newRequest, { from: Date }) →
  { newVersion: PlanVersion, diff: PlanDiff }

freezeBefore = max(today, startOfCurrentWeek)
              // if nothing is completed this week, the current week is
              // regenerated too; if anything is, the week is frozen

1. Copy all workouts dated < freezeBefore verbatim, with their
   status, activity links and notes intact.
2. Re-run the pipeline for the remaining weeks, seeding
   currentWeeklyKm / currentLongestKm from *actual completed* volume
   over the last 3 weeks rather than the original onboarding answers.
3. Match old → new workouts by stable `workoutKey`
   (`w{week}-{weekday}-{templateId}`) to carry over user notes and
   manual date moves where they still make sense.
4. Emit a PlanDiff.
```

```ts
type PlanDiff = {
  weeksAffected: number[]
  added: WorkoutSummary[]
  removed: WorkoutSummary[]
  changed: { before: WorkoutSummary; after: WorkoutSummary; fields: string[] }[]
  peakKmBefore: number; peakKmAfter: number
  totalKmBefore: number; totalKmAfter: number
}
```

The diff is **shown to the user before anything is written** — "Weeks 3–12 will
change. 41 workouts updated, peak drops 45km → 32km." They confirm, and only
then is a new `PlanVersion` inserted and `Plan.currentVersionId` repointed. The
old version is retained, so "undo" is a single-row update.

Seeding step 2 from *actual* volume is what makes this adaptive rather than
cosmetic: a user who has been under-running gets a gentler rebuild, not the
same curve shifted.

## 11. Lighter-weight edits (no regeneration)

Not every change needs a new version:

| Action | Effect |
|---|---|
| Drag a workout to another day | Updates `Workout.date` + `movedFromDate`. Validated: within ±7 days, not onto a day that already has a quality session, not two hard days consecutive. Rejected with a reason, or allowed with a warning the user can override. |
| Mark complete / skip | Status only |
| Add an extra workout (`+ Add`) | Inserts an ad-hoc `Workout` with `isExtra = true`; excluded from plan adherence totals but counted in actual volume |
| Edit notes | Notes only |
| Swap one workout for a different template | Replaces steps in place, keeps the date |

## 12. Testing

Vitest, against the pure functions — no DB, no mocks needed:

- **Golden snapshots.** Six canonical requests (beginner 5K/3 days, intermediate
  half/5 days, advanced marathon/6 days, mileage-capped half, 2-days-per-week,
  minimum-length 10K) snapshot the full generated plan. Any engine change that
  alters output shows up as a readable diff.
- **Invariants**, asserted across 200 randomly generated valid requests:
  - no week exceeds `targetWeeklyKm`
  - no week-over-week increase exceeds the progression rate (except post-cutback)
  - no long run exceeds 40% of its week
  - no two quality sessions on consecutive days
  - every workout falls on a `preferredDay`
  - sum of step distances equals `plannedDistanceM` within 50m
  - pace zones strictly ordered fastest → slowest
- **Riegel table** — known race equivalences checked against published values.
- **Regeneration** — completed workouts and their activity links survive; frozen
  weeks are byte-identical before and after.
