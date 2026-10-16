# 03 — Design System

Goal: look like a product, not a project. The screenshots are a dark,
high-contrast, card-based athletic UI. We copy that language rather than
inventing one, because it's proven and it's fast to build with Tailwind.

**Stack:** Tailwind CSS v4 + shadcn/ui (Radix primitives) + lucide-react icons
+ Recharts + Framer Motion for transitions. All free, all MIT.

## 1. Colour tokens

Dark is the **default and only** theme for v1. A light theme is a stretch goal;
building one badly is worse than not having one.

Declared as CSS custom properties on `:root`, consumed via Tailwind theme
extension.

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0C0F` | Page background (near-black) |
| `--surface` | `#1A2029` | Card background |
| `--surface-2` | `#242C38` | Nested card, input field, chip |
| `--surface-3` | `#2F3845` | Hover, pressed, skeleton shimmer |
| `--border` | `#2B3442` | 1px hairlines, dividers |
| `--border-strong` | `#3D4858` | Focused input, selected card outline |

### Text
| Token | Hex | Use |
|---|---|---|
| `--text` | `#FFFFFF` | Headings, numbers, primary labels |
| `--text-muted` | `#8E9BAC` | Secondary lines, units, axis labels |
| `--text-subtle` | `#5B6676` | Disabled, placeholder, empty days |

### Brand & semantic
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#3BE081` | Primary accent, progress fill, CTA |
| `--brand-dim` | `#1F7A47` | Muted bars in the plan overview chart |
| `--danger` | `#FF4D4F` | Missed days, destructive actions |
| `--warning` | `#FACC15` | "Jump too steep" style warnings |
| `--info` | `#38BDF8` | Race day, informational callouts |

### Workout type colours — **the most important tokens in the app**

Every workout chip, calendar dot, and detail header carries a 4px colour bar.
This is the user's primary scanning mechanism; it must be consistent everywhere.

| Type | Token | Hex | Swatch meaning |
|---|---|---|---|
| `RECOVERY` | `--w-recovery` | `#A3E635` | lime — easiest |
| `EASY` | `--w-easy` | `#4ADE80` | green |
| `LONG` | `--w-long` | `#A855F7` | purple |
| `TEMPO` | `--w-tempo` | `#FACC15` | yellow |
| `THRESHOLD` | `--w-threshold` | `#FB923C` | orange |
| `INTERVALS` | `--w-intervals` | `#EF4444` | red — hardest |
| `RACE_PACE` | `--w-racepace` | `#38BDF8` | blue |
| `RACE` | `--w-race` | `#F43F5E` | rose |
| `STRENGTH` | `--w-strength` | `#94A3B8` | slate |
| `REST` | — | no bar | absence is the signal |

Hard sessions trend warm, easy sessions trend cool-green, long runs are
purple. Derived from the screenshots: the Calendar shows green easy runs,
a yellow `Tempo 2-1-1`, orange/red `Pyramid Intervals` and a purple
`13km Long Run`.

Gradient variant for emphasis bars: `linear-gradient(90deg, var(--w-easy), var(--brand))`.

### Personal-record badge tiers
Hexagonal badges, each distance a fixed colour (from the Progress screenshot):

| Distance | Fill | Ring |
|---|---|---|
| 400m / 1K | `#3A3F47` | silver `#9CA3AF` |
| 1 mile | `#15181D` | near-black `#374151` |
| 2 mile | `#7F1D1D` | red `#DC2626` |
| 5K | `#1E3A8A` | blue `#3B82F6` |
| 5 mile | `#115E59` | teal `#14B8A6` |
| 10K | `#78350F` | gold `#D4A017` |
| 10 mile | `#4C1D95` | violet `#8B5CF6` |
| Half | `#831843` | magenta `#DB2777` |
| Marathon | `#064E3B` | emerald `#10B981` |

Locked (not yet achieved) badges render at 25% opacity, greyscale, with the
distance label only — this gives new users a visible goal instead of an
empty grid.

## 2. Typography

System font stack — no webfont download, no layout shift, free:

```css
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Numerals use `font-variant-numeric: tabular-nums` everywhere a figure can
change (distances, paces, timers) so digits don't jitter.

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Display (big stat: `40.4`) | 32 / 36 | 700 | -0.02em |
| H1 (page title) | 22 / 28 | 600 | -0.01em |
| H2 (card title) | 17 / 24 | 600 | 0 |
| Body | 15 / 22 | 400 | 0 |
| Body-strong | 15 / 22 | 600 | 0 |
| Caption | 13 / 18 | 400 | 0 |
| Label (`KILOMETERS`, `VIEW BY: WEEK`) | 11 / 14 | 600 | +0.08em, uppercase |

## 3. Spacing, radius, elevation

- **Spacing:** 4px base scale — `4 8 12 16 20 24 32 40 48 64`. Card padding 16,
  section gap 24, page gutter 16 (mobile) / 32 (desktop).
- **Radius:** card `16px`, nested card `12px`, chip/input `10px`, pill `9999px`,
  badge hexagon via `clip-path`.
- **Elevation:** no drop shadows on dark. Depth comes from surface lightness
  steps plus a 1px `--border` hairline. Only modals and the floating action
  pill get a shadow: `0 8px 32px rgba(0,0,0,.5)`.

## 4. Core components

Built once in `src/components/ui`, reused everywhere.

### `<WorkoutChip>`
The calendar/agenda atom.
```
┌─┬──────────────────────────────┐
│█│ Pyramid Intervals            │   █ = 4px type colour bar, full height
│█│ 8km                     ⚡   │   title 15/600, sub 13/400 muted
└─┴──────────────────────────────┘   right slot: status icon
```
Status icon slot: `⚡` linked to a Strava activity · `✓` completed manually ·
`↷` moved from another day · none if scheduled.
States: default, hover (`--surface-3`), dragging (scale .98, shadow), drop-target
(dashed `--brand` outline), completed (60% opacity + strikethrough distance).

### `<WorkoutCard>`
The larger Today-screen variant: title, `Friday, Oct 16 · 40m – 45m`,
`Tempo · 6km`, and a tappable completion circle on the right.

### `<StatRow>`
Ring-progress icon + label + value + chevron. Used for `Week 2 — 0/5 workouts`
and `Plan distance — 11/453km`. The ring is an SVG `stroke-dasharray` arc.

### `<WeekStrip>`
7 columns, `MON…SUN` label over a date. Date states: default, **today**
(white filled circle, dark text), **selected** (grey filled circle), **missed**
(red text). Beneath each date, up to 3 coloured dots, one per workout.

### `<SegmentedProgress>`
The `Week 2 Overview` bar: N equal segments with 4px gaps, filled `--brand`
when that workout is complete. Reads at a glance as "3 of 5".

### `<BarChart>`
Recharts wrapper. Two configurations:
- **Plan overview** — one bar per plan week, muted `--brand-dim`, current week
  highlighted `--brand`, 3 y-gridlines, week numbers on x.
- **Performance** — one bar per period, `--surface-3` fill, dashed vertical
  gridlines, dates on x, km on the right axis.

### `<PRBadge>`
Hexagon via `clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`,
distance label inside, time + date beneath.

### `<Sheet>` / `<Dialog>`
Radix primitives. Bottom sheet on mobile, centred dialog on desktop. Used for
Link Activity, Move Workout, Mark Complete, and all confirmations.

### `<EmptyState>`
Icon, one-line headline, one-line explanation, one primary action. Every list
in the app must have one — see [09 — Error & Edge States](./09-error-states.md).

## 5. Motion

Framer Motion, restrained. Fast enough to feel responsive, never decorative.

| Interaction | Animation | Duration |
|---|---|---|
| Route change | fade + 8px slide up | 180ms `ease-out` |
| Sheet open | slide from bottom | 240ms `cubic-bezier(.32,.72,0,1)` |
| Chip drag | scale .98, lift shadow | 120ms |
| Chip drop | spring settle into slot | 300ms spring |
| Progress ring / bar fill | animate from previous value | 500ms `ease-out` |
| Completion tick | scale 0→1.1→1 + brand flash | 350ms |
| Number counters | count up on first paint only | 600ms |

All of it wrapped in `prefers-reduced-motion: reduce` → durations to 0.

## 6. Accessibility floor

Not optional, and cheap to get right from the start:

- Colour is never the only signal. Workout type always has a text label next
  to its colour bar; completed state always has an icon, not just opacity.
- Contrast: `--text` on `--surface` is 14.8:1; `--text-muted` on `--surface`
  is 5.1:1. Both clear AA.
- Every interactive element has a visible focus ring:
  `outline: 2px solid var(--brand); outline-offset: 2px`.
- Drag-and-drop has a keyboard path: focus a chip, `Space` to lift,
  arrow keys to move, `Space` to drop, `Esc` to cancel. dnd-kit provides this
  if the sensors are configured.
- Charts have an accessible table fallback behind a "View as table" toggle.
- Minimum touch target 44×44px.

## 7. Writing style

- Numbers lead. `0/37.5KM`, not `You have run 0 of 37.5 kilometres`.
- Units lowercase and attached: `6km`, `5:12/km`, `40m – 45m`.
- Sentence case for everything except the 11px uppercase labels.
- Errors say what happened and what to do: *"Strava disconnected — reconnect to
  keep syncing runs"*, not *"Error 401"*.
