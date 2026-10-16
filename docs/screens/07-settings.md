# S7 — Settings & Connections

Replaces the *Support* tab from the screenshots, which is a help-centre link
rather than application functionality.

Route: `/settings`, with `/settings/connections` as the sub-page that matters.

## `/settings` layout

```
┌────────────────────────────────────────────────┐
│ ‹            Settings                          │
├────────────────────────────────────────────────┤
│  ( avatar )  Shrikant Shingare                 │
│              shri@example.com                  │
│                                      Edit ›    │
├────────────────────────────────────────────────┤
│  TRAINING                                      │
│  Ability                    Intermediate  ›    │
│  Recent race result       10K in 50:00   ›     │
│  Your pace zones                          ›    │
├────────────────────────────────────────────────┤
│  PREFERENCES                                   │
│  Units                      Kilometres    ›    │
│  Timezone                   Asia/Kolkata  ›    │
│  Week starts on             Monday        ›    │
│  Notifications                            ›    │
├────────────────────────────────────────────────┤
│  CONNECTED APPS                                │
│  ┌────────────────────────────────────────┐    │
│  │ 🟠 Strava            Connected      ›  │    │
│  │    Last synced 4 minutes ago           │    │
│  └────────────────────────────────────────┘    │
├────────────────────────────────────────────────┤
│  DATA                                          │
│  Export my data                           ›    │
│  Delete account                           ›    │
├────────────────────────────────────────────────┤
│  Sign out                                      │
│  v1.0.0 · Not affiliated with Runna or Strava  │
└────────────────────────────────────────────────┘
```

## Training section

**Changing ability or the pace basis changes every future pace target**, so
these edits route through the same preview-then-commit flow as Manage Plan:

```
Recent race result: 10K 50:00 → 10K 47:30
   ↓
"This changes your pace zones:
   Easy       5:45–6:05  →  5:31–5:51
   Threshold  4:47–4:55  →  4:35–4:43
 42 future workouts will get new targets."
   [Cancel]  [Update]
```

**Your pace zones** is a read-only page listing all eight zones with their
ranges and a one-line description of what each is for.

## Preferences

- **Units** — `KM` / `MI`. Flips every distance and pace in the app
  immediately. Conversion lives only in `src/lib/units.ts`; nothing is
  re-stored, because the database is always metric.
- **Timezone** — determines what "today" means and which local day an activity
  belongs to. Defaults from the browser, editable.
- **Week starts on** — Monday / Sunday, affects the week strip, the calendar
  grouping and rollup boundaries.
- **Notifications** — per-type toggles: new PR, workout auto-linked, plan
  realignment suggested, weekly summary, Strava disconnected.

## `/settings/connections`

```
┌────────────────────────────────────────────────┐
│ ‹          Connected Apps                      │
├────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐ │
│ │ 🟠  Strava                                 │ │
│ │     Connected as Shrikant S.               │ │
│ │     Last synced 4 minutes ago              │ │
│ │     312 activities imported                │ │
│ │                                            │ │
│ │     [ Sync now ]        [ Disconnect ]     │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│  AUTOMATIC LINKING                             │
│  Link runs to workouts automatically     [on]  │
│  Only link same-day runs                 [off] │
│  Import runs from before the plan        [off] │
├────────────────────────────────────────────────┤
│  COMING SOON                                   │
│  ⌚ Garmin         Not available           ○    │
│  ⌚ COROS          Not available           ○    │
│  Both can sync to Strava, which we read.       │
└────────────────────────────────────────────────┘
```

### Connection states

| State | Card shows |
|---|---|
| Never connected | Strava logo, one-line explanation of what connecting does, exactly which permissions are requested, `[ Connect Strava ]` |
| Connecting | Spinner + "Waiting for Strava…", cancellable |
| Connected | Athlete name, last sync, activity count, `[Sync now]` `[Disconnect]` |
| Syncing | Progress: "Importing 312 activities… 180/312", cancellable |
| Revoked | Amber card: "Access was revoked in Strava. Reconnect to resume syncing." + `[Reconnect]` |
| Error | Red card with the last error and a retry; existing data untouched |
| Rate limited | "Strava is rate limiting us. Next sync in 8 minutes." with a countdown |

**Disconnect** opens a confirmation that is explicit about consequences:

```
┌────────────────────────────────────────────────┐
│  Disconnect Strava?                            │
│                                                │
│  • New runs will stop importing                │
│  • Your 312 imported activities stay           │
│  • Workout links stay                          │
│  • Access is revoked on Strava's side too      │
│                                                │
│  [ Cancel ]            [ Disconnect ]          │
│                                                │
│  Also delete imported activities?         [ ]  │
└────────────────────────────────────────────────┘
```

Keeping the user's training history by default is the right call; deleting it
is an explicit, separate opt-in.

## Data section

- **Export my data** — `GET /api/me/export` streams a JSON file containing
  plans, workouts, activities, links and records. One click, no email flow.
- **Delete account** — requires typing the email address to confirm. Hard
  delete, cascades every table, revokes the Strava token first.

## `/settings/debug` (own account only)

A small internal page that makes the invisible parts of the system visible:
Strava connection state and token expiry, the last 20 webhook events with their
processing status, rollup freshness per week, and the current plan version
history. Cheap to build, genuinely useful while developing, and it gives the
demo video something concrete to show for the webhook pipeline.

## States

| State | Behaviour |
|---|---|
| Loading | Skeleton rows |
| Save in flight | Row shows an inline spinner; the control disables |
| Save failed | Row reverts with an inline error and Retry |
| Pace change pending | Preview sheet; nothing written until confirmed |
| Password change | Requires the current password; wrong password is a field-level error |
| Export large | Streamed response with a progress toast |
| Delete in progress | Full-screen blocking state, then redirect to `/` with a confirmation |
