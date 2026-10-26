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

## Colour

| Token | Hex | Reasoning |
|---|---|---|
| `--ink` | `#0F141B` | Ground. Cold and faintly blue rather than neutral black — running happens before sunrise, and the app is most often opened at 6am. |
| `--slate` | `#19202A` | Card surface. |
| `--slate-2` | `#232C38` | Nested surface, input, chip. |
| `--chalk` | `#F4F6F8` | Text, and the **primary action**. Lane markings are chalk on track. The reference screenshot already makes its main button a white pill, so this is in the brief. |
| `--rust` | `#B8472A` | Single warm accent: race day, records, the one thing on screen that matters most. A 400m track surface is genuinely this colour — it is subject matter, not a terracotta default. |
| `--ash` | `#8A95A3` | Secondary text. |

The nine workout-type colours are unchanged. They are a functional
green-to-red effort spectrum and the user scans by them.

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
