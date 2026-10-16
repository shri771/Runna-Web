# S1 — Auth & Plan Builder

No screenshot for this one — it's the flow that produces everything the other
screens display, and it's workflow **W1**.

## 1. Landing `/`

A single scrolling page. Its job is to make an evaluator understand the product
in ten seconds.

```
┌──────────────────────────────────────────────────┐
│  Runna Web                      Sign in  [Start] │
├──────────────────────────────────────────────────┤
│                                                  │
│   Your race. Your schedule. Your plan.           │
│   A training plan that's actually built around   │
│   how much you can run — and that updates when   │
│   that changes.                                  │
│                                                  │
│   [ Build my plan ]   [ Try the demo account ]   │
│                                                  │
│   ┌────────┐ ┌────────┐ ┌────────┐               │
│   │ Today  │ │  Plan  │ │ Progr. │  screenshots  │
│   └────────┘ └────────┘ └────────┘               │
├──────────────────────────────────────────────────┤
│  Three cards:                                    │
│   1. Tell us your race and your mileage          │
│   2. Get a week-by-week plan with pace targets   │
│   3. Link your Strava runs and track adherence   │
└──────────────────────────────────────────────────┘
```

**"Try the demo account"** signs into the seeded account from
`src/lib/db/seed.ts` — a half-marathon plan at week 6 with completed workouts,
linked activities and PRs. An evaluator shouldn't have to create a plan before
seeing the product work.

## 2. Sign up `/sign-up` · Sign in `/sign-in`

Centred card, 400px, on `--bg`.

| Field | Validation |
|---|---|
| Name | required, 2–60 chars |
| Email | required, valid, lowercased |
| Password | min 8, not in the common-password list, strength meter |

- Inline validation on blur, not on every keystroke.
- Submit button shows a spinner and disables; double-submit is impossible.
- Server errors render above the form, not as a toast that can be missed.
- "Duplicate email" deliberately returns the same success state as a real
  signup (no account enumeration) — documented in the code so it doesn't read
  as a bug.
- `?next=` is preserved through sign-in.

Success → `/onboarding`.

## 3. Plan Builder `/onboarding`

Six steps, one question group per step, a progress bar across the top, Back
always available. The draft is written to `localStorage` on every change, so a
refresh doesn't lose it.

### Step 1 — Goal
Five large tappable cards, 2-up on mobile:

```
┌───────────┐ ┌───────────┐
│    5K     │ │   10K     │
│  4+ weeks │ │  6+ weeks │
├───────────┤ ├───────────┤
│   Half    │ │ Marathon  │
│  8+ weeks │ │ 12+ weeks │
└───────────┘ └───────────┘
┌───────────────────────────┐
│  Just build my mileage    │
│  no race, pick a length   │
└───────────────────────────┘
```

### Step 2 — When
- Date picker for race date (or a 4–52 week slider for `BUILD_MILEAGE`).
- Optional race name — shown on the Plan screen hero.
- **Live feedback under the picker**: *"That's 11 weeks — a good length for a
  half marathon."* or, in red, *"That's 5 weeks. A half marathon plan needs at
  least 8."* with the earliest valid date offered as a one-tap fix.

### Step 3 — Your week
- **Days per week**: segmented control 2–7.
- **Which days**: seven toggle pills, `M T W T F S S`. Must select at least
  `daysPerWeek`; selecting fewer disables Next with an explanation.
- **Long run day**: dropdown, restricted to the selected days, defaults to
  Sunday if available.

### Step 4 — Where you are now
- **Ability**: Beginner / Intermediate / Advanced, each with a one-line
  description so people self-select honestly.
- **Current weekly distance**: slider 0–120km with a numeric input.
- **Longest recent run**: slider, capped at weekly distance (the cap moves with
  the slider above it, which prevents the invalid combination rather than
  erroring about it later).

### Step 5 — Your pace
Three tabs, because people arrive with different information:

| Tab | Input |
|---|---|
| **Recent race** | Distance dropdown + time input → best accuracy |
| **Estimated 5K** | Time input |
| **I don't know** | Easy-pace input, or skip entirely for ability-based defaults |

Below, the derived zones preview immediately:
```
Easy        5:45 – 6:05 /km
Long        5:40 – 6:15 /km
Threshold   4:47 – 4:55 /km
Intervals   4:22 – 4:28 /km
```
Showing the output of the Riegel conversion here makes the app feel like it
knows something, and it lets the user sanity-check before committing.

### Step 6 — How hard — **the customisation step**

This is the step the whole product is about.

```
┌────────────────────────────────────────────────┐
│  Target weekly distance                        │
│  ├────────────●──────────────┤   38 km         │
│  28 km now                    60 km            │
│                                                │
│  How quickly to build up                       │
│  ( Gradual )  ( Steady* )  ( Aggressive )      │
│    +4%/wk       +7%/wk       +10%/wk           │
│                                                │
│  ▸ Advanced caps                               │
│      Max easy run      10 km                   │
│      Max long run      19 km                   │
│      Max hard session  12 km                   │
├────────────────────────────────────────────────┤
│  YOUR PLAN                                     │
│      ▁▃▄▃▅▆▆▄▇▇▅▃                              │
│      1 2 3 4 5 6 7 8 9 10 11 12                │
│                                                │
│  12 weeks · 60 workouts · 453 km total         │
│  Peak week 38 km · Longest run 19 km           │
│                                                │
│  ⚠ Reaching 38km needs a 9% weekly build.      │
│    [Use gradual]  [Lower to 34km]  [Keep it]   │
└────────────────────────────────────────────────┘
```

Every control re-fetches `POST /api/plans/preview` (debounced 400ms) and the
chart animates to the new curve. **Nothing is persisted yet.** The warnings are
the `PlanIssue[]` from the engine, each rendered with its suggested patches as
one-tap buttons.

This live preview is the single best thing in the product to demo: drag one
slider, watch twelve weeks of training reshape.

### Generate

`[ Create my plan ]` → `POST /api/plans` → transaction → `/today` with a
one-time success banner and a prompt:

```
┌──────────────────────────────────────────┐
│  Plan ready. 60 workouts, 12 weeks.      │
│  Connect Strava to track them            │
│  automatically?      [Connect] [Later]   │
└──────────────────────────────────────────┘
```

"Later" is a real option — the app is fully usable with manual completion, and
the banner reappears in Settings rather than nagging.

## 4. States

| State | Behaviour |
|---|---|
| Preview loading | Chart dims to 40% with a shimmer; the previous curve stays visible rather than collapsing to empty |
| Preview failed | Inline retry under the chart; Next stays enabled using the last good preview |
| Blocking issues | Next disabled, issues listed with the offending field highlighted and scrolled into view |
| Generate in flight | Button → spinner, all inputs disabled, Back blocked |
| Generate failed | Error with the engine's reason + Retry. Nothing partially written — the whole thing is one transaction |
| Plan already active | `409` → "You already have an active plan" + [Open it] / [Replace it] |
| Returning mid-wizard | Draft restored from `localStorage` with "Picked up where you left off" |

## 5. Desktop

Two columns from 1024px: the question group on the left (max 520px), the live
preview card **sticky on the right**. On mobile the preview sits beneath the
controls and a compact summary bar (`38km peak · 453km total`) pins above the
Next button so the numbers are always visible while dragging.
