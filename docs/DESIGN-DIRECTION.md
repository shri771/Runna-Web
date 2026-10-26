# Design direction

The reference screenshots fix the **layout and information architecture**, and
those are good — they stay. This document covers the **visual language**, where
the screenshots left things at a generic default.

## The problem with the first token pass

The original tokens were a faithful Runna clone: neutral near-black `#0A0C0F`
with a bright acid green `#3BE081`, and tracked-out uppercase eyebrow labels
above every section. That combination is the single commonest look in generated
UI, and two parts of it are actively wrong for this product:

**Green was doing two unrelated jobs.** Green meant "brand, primary action,
progress" and also meant "easy run". A green progress bar sitting next to a
green workout chip encodes two different things in one colour. The effort
spectrum has the stronger claim — green-to-red as intensity is *information*,
not decoration — so the brand colour moves off green entirely.

**Uppercase eyebrows were chrome.** `PACE INSIGHTS` above a card titled pace
insights tells the reader nothing. Uppercase survives in exactly one place:
unit labels under a figure (`KILOMETERS`, `TIME`), which is race-results and
timing-display convention.

## Third pass: a computed palette

The second pass was rejected: still flat. Two reasons, both findable in the
theory rather than by taste.

**The ground was working against the accent.** A warm brown-black is
*analogous* to amber — adjacent on the hue wheel — so there was almost no hue
contrast between the accent and what sat behind it, and amber read muddy
instead of luminous. Yellow's complement is blue, and a light yellow on a dark
blue reads naturally while the reverse feels wrong even at identical contrast
ratios, because it runs with the inherent lightness of those hues rather than
against it. So the ground moved to a deep blue (hue 258) and amber stayed where
it was. Blue carries the structure, amber carries the accent layer.

**The values were eyeballed.** Everything is now authored in **OKLCH**, which is
perceptually uniform: two colours at the same L genuinely look equally light, so
lightness steps can be reasoned about instead of guessed. Surfaces climb in even
L steps at deliberately low chroma, because saturated greys muddy fast on dark.

Yellow as a true primary is defensible precisely because this is a dark-first
product: on a dark ground yellow is the brightest hue a screen can produce, and
this amber measures **12.4:1 on the page background** — enough to carry body
text, not just decoration. That is the one context where yellow can lead.

### Measured, not assumed

| Colour | On `ink` | On `slate` | AA body (4.5) |
|---|---|---|---|
| `chalk` | 17.7:1 | 16.0:1 | pass |
| `ash` | 8.2:1 | 7.4:1 | pass |
| `ash-dim` | 5.0:1 | 4.5:1 | pass |
| `amber` | 12.4:1 | 11.2:1 | pass |
| `danger` | 5.2:1 | 4.7:1 | pass |

`ash-dim` originally came out at 4.1:1 and was raised until it cleared.

Every effort colour clears 4.4:1 on a card, sits at least 20° of hue away from
amber, and is held inside a narrow lightness band (0.68–0.86) so intensity is
carried by **hue**, not by brightness — otherwise the hardest session would also
be the dimmest chip on the screen. The band was initially 0.23 wide and was
tightened to 0.175.

### Hierarchy

Colour was only half of why it read flat. Every card had the same border, the
same fill and the same weight, so nothing told the eye where to land. Cards now
come in two weights — `raised` for the one thing a screen is about, `quiet` for
everything else — and each screen has exactly one large figure: the session
distance on Today, the day count on Plan, the week's volume on Progress.

## Second pass: amber

The client asked for a yellow-toned palette. The obvious move — keep the cold
near-black and drop in an acid yellow — would have landed on exactly the
generic shape the first pass was rejected for, just in a different hue.

So the **ground moved warm** instead. Running happens at 6am under sodium
street lamps, and that light is amber; a warm near-black is what wet asphalt
actually looks like at that hour. On a warm ground amber is a native
inhabitant rather than an accent bolted onto a cold scheme.

That forced one real restructure. Yellow was already in the effort spectrum as
*tempo*, so making it the brand colour would have recreated the exact ambiguity
the first pass removed from green. The resolution: **amber means the goal** —
primary actions, race day, personal records, and nothing else. The effort
spectrum keeps green-to-red and now contains no yellow at all, with tempo
shifted to orange.

Yellow being what you are working toward, and never what you are doing right
now, is a rule the whole interface can hold.

## Colour

| Token | Hex | Reasoning |
|---|---|---|
| `--ink` | `#14110A` | Ground. Warm near-black — wet asphalt under a sodium street lamp. |
| `--slate` | `#1E1910` | Card surface. |
| `--slate-2` | `#292218` | Nested surface, input, chip. |
| `--chalk` | `#F7F2E4` | Text. Warm white — chalk and paper, not screen white. |
| `--amber` | `#F2C230` | The goal: primary actions, race day, records. Never used for effort. |
| `--ash` | `#A69A80` | Secondary text, warm grey. |

The nine workout-type colours are a functional green-to-red effort spectrum
and the user scans by them. Tempo moved from yellow to orange so the spectrum
contains no yellow, leaving amber free to mean only "the goal".

## Type

Two families, clearly distinct, both self-hosted via `next/font` so there is no
layout shift and no third-party request.

**Barlow Condensed** for figures and distances. Race bibs, result sheets and
split tables are all set condensed — it is the native typography of the sport.
It also buys horizontal room, which matters on a week strip with seven columns
of numbers.

**Inter** for everything else: UI, body, labels. Neutral on purpose, so the
figures carry the personality.

Figures use tabular numerals everywhere a value can change, so digits do not
jitter as a workout completes.

## The one bold thing

**Every workout renders as its own silhouette** — a small bar profile of the
session's intensity over its distance. Pyramid intervals literally look like a
pyramid; a tempo shows two plateaus; an easy run is a flat line. The data is
already in `workouts.steps`, so this costs nothing to compute.

No other running app leads with the shape of the session. It is the signature
element, it appears on the Today card, calendar chips and workout detail, and
everything around it stays quiet and disciplined.

## Restraint

One accessory removed: no gradient washes, no card shadows, no hover lift on
every tile. Depth comes from surface lightness steps and a single hairline.
Motion answers actions only — a completion tick, a sheet opening — with one
exception, the plan curve animating to its new shape when the mileage target
changes, because that *is* the product.
