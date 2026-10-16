# 01 — Product Brief

## Problem

Someone who signs up for a half marathon has two bad options:

1. **A free static PDF plan.** It doesn't know their current fitness, it assumes
   they can run on the days it says, it gives no pace targets, and the moment
   they miss a week it's wrong and stays wrong.
2. **A human coach.** Correct, adaptive, and £100+/month.

The gap in between is where almost every amateur runner lives. They also already
have their runs recorded — in Strava, on a watch — but that data sits in a
separate app from the plan, so nobody can answer *"am I actually on track?"*
without manual spreadsheet work.

## Target user

**Primary:** an amateur runner with a target race 8–20 weeks out who runs 3–5
times a week, already uses Strava, and wants structure without hiring a coach.

**Secondary:** a runner with no race, who just wants to build up to a distance
or hold a consistent weekly volume.

Explicitly *not* targeting: elite athletes, treadmill-only users, or anyone
wanting a social feed. Strava already owns the feed.

## Solution

A web app that:

1. **Generates a real plan.** Not a lookup table — a periodised plan computed
   from the user's inputs, with warm-ups, intervals, recoveries and cool-downs,
   each step carrying a target pace range derived from the user's own race data.
2. **Stays the user's plan.** Weekly mileage cap, days per week, long-run day,
   per-run-type distance caps, and progression rate are all editable *after*
   creation. Changing them regenerates only the future, never the logged past.
3. **Closes the loop with Strava.** Activities flow in automatically; the app
   matches each one to the planned workout it was meant to be, or the user links
   it by hand. Completion, compliance and personal records all fall out of that.

## The 5 core workflows

These are the workflows that must work end-to-end. Everything else is secondary.

### W1 — Create a plan
```
Sign up
  → Choose goal (5K / 10K / Half / Marathon / Build mileage)
  → Enter race date, days/week, preferred days, long-run day
  → Enter current fitness (weekly mileage, longest run, recent race time)
  → Set target weekly mileage + progression rate
  → See live preview of the week-by-week mileage curve
  → Validate (too short? jump too steep? fewer days than runs?)
  → Generate & persist ~12 weeks × ~5 workouts, each with structured steps
```
Covered in: [S1](./screens/01-auth-and-plan-builder.md), [04 — Plan Engine](./04-plan-engine.md)

### W2 — Customise & rearrange
```
Open Plan → Manage Plan
  → Change target weekly mileage (e.g. 40 → 32 km)
  → See diff preview: "Weeks 3–12 will change, 41 workouts affected"
  → Commit → new PlanVersion, completed history preserved
```
and the lighter-weight version:
```
Open Calendar
  → Drag Thursday's intervals onto Saturday
  → App validates (no two hard sessions back-to-back, within ±1 week)
  → Accept, warn, or reject with a reason
```
Covered in: [S3](./screens/03-plan.md), [S4](./screens/04-calendar.md), [04 — Plan Engine §7](./04-plan-engine.md)

### W3 — Connect Strava & link an activity
```
Settings → Connect Strava → OAuth consent → tokens stored encrypted
  → Backfill recent runs
  → Webhook delivers new activities as they're uploaded
  → Auto-matcher scores each activity against nearby planned workouts
      ≥ 0.75 confidence  → linked automatically, workout marked complete
      below threshold    → shown as "Suggested match" on the workout
  → Or: open any workout → "Link activity" → pick from recent unlinked runs
```
Covered in: [S5](./screens/05-workout-detail.md), [05 — Strava Integration](./05-strava-integration.md)

### W4 — Execute the week
```
Open Today
  → See today's session with its full step breakdown and pace targets
  → Mark complete manually, or let a linked Strava activity do it
  → Week Overview updates (3/5 workouts, 22.4/37.5 km)
  → Insights recompute (mileage on track? pace drifting?)
```
Covered in: [S2](./screens/02-today.md)

### W5 — See overall progress
```
Open Progress
  → Performance tab: distance / time / activity count for week|month|year,
    rolling bar chart, Personal Records grid
  → Workouts tab: completed sessions with compliance grade and pace vs target
  → Plan adherence: 11/453 km of the plan done, week-by-week completion
```
Covered in: [S6](./screens/06-progress.md), [S3](./screens/03-plan.md)

## What the user can actually do — feature list

| Area | Features |
|---|---|
| Account | Email/password sign-up, session auth, profile, units (km/mi), timezone |
| Plan creation | 5 goal types, race-date or fixed-length, 2–7 days/week, ability level, pace basis from a recent race result, live preview before commit |
| Plan customisation | Target weekly mileage, progression rate (gradual/steady/aggressive), long-run day, preferred days, per-type distance caps, race date move, plan pause |
| Workouts | Structured steps with nested repeats, per-step pace ranges, duration estimate, type colour coding, notes, mark complete/skip, add an extra ad-hoc workout, delete |
| Rearranging | Drag-and-drop within ±1 week, validation rules, undo, permanent schedule change via Manage Plan |
| Strava | OAuth connect/disconnect, historical backfill, live webhook sync, auto-match, manual link/unlink, duplicate protection, PR extraction |
| Progress | Weekly/monthly/yearly rollups, distance + time + count, bar chart, plan adherence rings, personal records across 9 distances, compliance grading |
| Reliability | Token auto-refresh, webhook idempotency, rate-limit backoff, retryable job queue, optimistic UI with rollback |

## Scope boundaries (deliberately out)

| Not building | Why |
|---|---|
| Native mobile app | Responsive web covers the evaluation; a PWA shell is the stretch goal |
| Live in-run audio coaching | Needs native background audio + GPS; out of reach for a web submission |
| Garmin / COROS / Apple Health | One integration done properly beats three done shallowly. Those devices can sync to Strava, which we read. |
| Social feed, clubs, comments | Not the problem being solved |
| Payments / subscriptions | No business model to validate here |
| Strength & nutrition plans | Adjacent product, dilutes the running engine |

Per the brief: **depth over feature count.** Five workflows, each complete.

## Why this is software and not a spreadsheet

The plan is not stored data, it is *computed* data. A spreadsheet can hold 60
workouts; it cannot re-derive them when you drop your mileage cap from 40 to 32
in week 5 while keeping your four completed runs intact, nor can it watch a
webhook and decide that this morning's 6.1 km at 5:12/km was the 6 km tempo it
was supposed to be.
