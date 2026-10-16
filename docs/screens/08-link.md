# S8 — Link

Replaces any attempt at in-app run recording. A browser can't reliably track
GPS in the background, so the app doesn't pretend to — **tracking means linking
what you already recorded in Strava to what you were supposed to run.**

This tab is that workflow in one place: an inbox for activities that haven't
been reconciled with the plan yet.

Route: `/link`

## Why a tab and not a button

The linking flow also exists on each workout's detail screen, but that's
one-at-a-time and requires you to remember which session is unresolved. After a
week away the user has five unlinked runs and three workouts waiting; the tab
reconciles all of them in one pass. It's also the clearest place to surface the
auto-matcher's low-confidence guesses, which otherwise have nowhere to live.

## Mobile layout

```
┌────────────────────────────────────────────────┐
│ (◔)             Link                      🔔   │
├────────────────────────────────────────────────┤
│  🟠 Strava · synced 4m ago       [ Sync now ]  │
├────────────────────────────────────────────────┤
│  NEEDS REVIEW                             (2)  │
│ ┌────────────────────────────────────────────┐ │
│ │  Morning Run           Fri 16 Oct · 06:42  │ │
│ │  6.12 km · 31:48 · 5:12/km                 │ │
│ │                                            │ │
│ │           ↕  91% match                     │ │
│ │                                            │ │
│ │ ▌Tempo 2-1-1           Fri 16 Oct · 6 km   │ │
│ │                                            │ │
│ │ [  Link  ] [ Choose another ] [ Dismiss ]  │ │
│ └────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────┐ │
│ │  Evening Run           Wed 14 Oct · 19:05  │ │
│ │  5.48 km · 32:10 · 5:52/km                 │ │
│ │           ↕  68% match                     │ │
│ │ ▌5.5km Easy Run        Wed 14 Oct · 5.5 km │ │
│ │ [  Link  ] [ Choose another ] [ Dismiss ]  │ │
│ └────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  UNLINKED RUNS                            (5)  │
│ ┌────────────────────────────────────────────┐ │
│ │  Lunch Run             Thu 15 Oct · 12:30  │ │
│ │  8.04 km · 44:12 · 5:30/km    [ Link to… ] │ │
│ ├────────────────────────────────────────────┤ │
│ │  Parkrun               Sat 11 Oct · 09:00  │ │
│ │  5.00 km · 22:14 · 4:27/km    [ Link to… ] │ │
│ └────────────────────────────────────────────┘ │
│  Show older runs ›                             │
├────────────────────────────────────────────────┤
│  WORKOUTS WAITING                         (3)  │
│ ┌────────────────────────────────────────────┐ │
│ │ ▌Pyramid Intervals     Thu 15 Oct · 8 km   │ │
│ │  Nothing linked yet          [ Find run ]  │ │
│ ├────────────────────────────────────────────┤ │
│ │ ▌13km Long Run         Sun 11 Oct · 13 km  │ │
│ │  Nothing linked yet          [ Find run ]  │ │
│ └────────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  Today   Plan   Calendar   Link   Progress     │
└────────────────────────────────────────────────┘
```

## Sections

### Sync bar
Connection status, relative last-sync time, and a `[ Sync now ]` button
(`POST /api/integrations/strava/sync`, rate limited to 1/min). While syncing it
becomes a progress row: `Importing… 180/312`.

If Strava isn't connected the whole screen collapses to a single empty state —
see States below.

### Needs review — the auto-matcher's suggestions
Activities the matcher scored between **0.45 and 0.75**: confident enough to
propose, not confident enough to apply (see
[05 — Strava Integration §4](../05-strava-integration.md)).

Each card pairs the activity above with the proposed workout below, separated
by the confidence percentage, so the comparison is vertical and immediate —
distance against distance, time against time.

| Action | Effect |
|---|---|
| **Link** | `POST /api/workouts/:id/link`, card animates out, counter decrements |
| **Choose another** | Opens the workout picker: nearby unmatched workouts, ranked by score |
| **Dismiss** | Suggestion hidden; the activity drops to *Unlinked runs*. Stored so it isn't re-suggested |

Anything scoring ≥ 0.75 was already linked automatically and never appears
here — it shows up in Today and Calendar with a `⚡` badge instead.

### Unlinked runs
Strava (and manual) activities with no link, newest first, infinite scroll.
`[ Link to… ]` opens a sheet of candidate workouts within ±7 days, each row
showing planned distance and the delta against the activity
(`6 km · +0.12 km`), nearest first.

### Workouts waiting
The mirror image: past workouts, still `SCHEDULED`, with no activity. Each has
`[ Find run ]`, which opens the same picker from the other direction, plus a
`⋯` menu with **Mark complete** (no data) and **Skip**.

This section is what makes the tab an inbox rather than a list — the goal state
is all three sections empty.

## Interactions

| Action | Behaviour |
|---|---|
| Link | Optimistic: card animates out, counters update, undo toast for 10s |
| Link conflict (`409`) | Conflict sheet with **Move it here instead** |
| Swipe left on a suggestion | Dismiss |
| Swipe right on a suggestion | Link |
| Pull to refresh | Re-sync if `lastSyncAt` > 5 min |
| Tap any activity row | → `/activities/[id]` |
| Tap any workout row | → `/workouts/[id]` |

## Badge

The tab shows a count badge of items in **Needs review** only — not the total
backlog. A badge that counts every old unlinked run becomes permanent noise and
gets ignored.

## States

| State | Behaviour |
|---|---|
| Loading | Three skeleton cards |
| **All clear** | Single centred state: "Everything's linked. 31 of 38 sessions matched to a run." with a small adherence ring. This is the goal state and should feel like one. |
| Strava not connected | Full-screen empty state: what connecting does, which permissions are asked for, `[ Connect Strava ]`, and `[ Log a run manually ]` underneath so the screen is never a dead end |
| Connected, zero activities | "No runs imported yet" + `[ Sync now ]` |
| Strava revoked | Amber banner + `[ Reconnect ]`; existing unlinked items still linkable, since they're already in our database |
| Rate limited | Sync button disabled with a countdown: "Next sync in 8 min" |
| Sync failed | Inline error on the sync bar + Retry; the lists below still render from cached data |
| Link failed (network) | Card returns with a toast + Retry |
| Only suggestions, no unlinked | Lower sections hide entirely rather than showing empty headers |

## Desktop

Two columns at ≥1024px: **Needs review** spans the full width at the top, then
*Unlinked runs* on the left and *Workouts waiting* on the right — so a run and
the workout it belongs to sit side by side. Drag an activity card onto a
workout card to link them, with the same validation and conflict handling as
the buttons.
