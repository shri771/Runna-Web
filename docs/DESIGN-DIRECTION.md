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
