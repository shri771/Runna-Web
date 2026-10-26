# Runna Web

A running coach that builds your training plan around how much you can
actually run — and rebuilds it when that changes.

**Live:** _not deployed yet — see [Deployment](#deployment)_
**Demo account:** `demo@runna.local` / `runna-demo-2026` (created by `npm run db:seed`)

---

## Problem statement

Someone who signs up for a half marathon has two realistic options, and both
are bad.

A **free static PDF plan** doesn't know their current fitness, assumes they can
run on the days it prescribes, gives no pace targets, and the moment they miss
a week it is wrong and stays wrong. A **human coach** is correct and adaptive,
and costs £100+ a month.

Almost every amateur runner lives in the gap between those. They also already
record their runs — in Strava, on a watch — but that data sits in a different
app from the plan, so nobody can answer *"am I actually on track?"* without
building a spreadsheet.

## Target users

**Primary:** an amateur runner with a target race 8–20 weeks out, running 3–5
times a week, already using Strava, who wants structure without hiring a coach.

**Secondary:** a runner with no race who wants to build up to a distance or
hold a consistent weekly volume.

Deliberately not built for elite athletes, treadmill-only users, or anyone
wanting a social feed — Strava already owns the feed.

## Solution

Three things the PDF cannot do.

**It generates a real plan.** Not a lookup table: a periodised block computed
from the runner's own inputs, with warm-ups, intervals, recoveries and
cool-downs, each step carrying a target pace range derived from their own race
result.

**It stays the runner's plan.** Weekly mileage ceiling, days per week,
long-run day, per-run-type distance caps and progression rate are all editable,
and the engine treats the mileage target as a ceiling rather than a
destination — when the curve reaches it, the weeks that follow get harder
rather than longer.

**It closes the loop with what was actually run.** Recorded runs are matched to
the session they were meant to be, scored on date, distance and duration.
Confident matches link themselves; plausible ones are offered for confirmation.
Completion, adherence and personal records all fall out of that.

## Key features

| Area | What a user can do |
|---|---|
| Account | Email/password sign-up and sign-in, session auth, guarded routes |
| Plan creation | Six-step wizard across 5 goal types, 2–7 days a week, with a **live preview** — drag the mileage slider and the whole block reshapes before anything is saved |
| Plan engine | Periodised base/build/peak/taper, cutback weeks, taper curve, long-run progression, constraint-based day scheduling, 13 session templates with per-interval pace targets |
| Workouts | Structured steps with nested repeats, pace range per step, duration estimate, completion, skip, notes |
| Linking | Match-scored suggestions, manual "link to…", conflict recovery when a run is already attached elsewhere, unlink |
| Progress | Weekly volume, plan adherence, compliance breakdown, personal records across 10 distances |
| Reliability | Optimistic updates that roll back and say so, ownership checks on every mutation, rate limiting, typed error envelope |

### Honest status

Built and working: auth, the plan engine, plan creation and persistence, and
all six app screens on real data.

**Not built:** Strava OAuth. The linking workflow is complete and the data model
and sync design are specified in [`docs/05-strava-integration.md`](docs/05-strava-integration.md),
but runs currently arrive via the seed script or manual entry rather than a live
Strava connection. Also unbuilt: drag-and-drop rearranging, the plan
regeneration diff, and the workout detail screen — all specified, none shipped.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript | Server Components mean most pages need no client fetching; one repo, one deploy |
| UI | Tailwind v4, lucide-react, Barlow Condensed + Inter | Condensed figures are the native typography of race results |
| Database | Neon Postgres + Drizzle ORM | Serverless Postgres over HTTP, no pool exhaustion; readable committed migrations |
| Auth | Auth.js v5, credentials provider, bcrypt | Self-hosted, so the authorization logic stays in the application |
| Validation | Zod | One schema per boundary, shared client and server |
| Tests | Vitest | The engine is pure functions, so unit tests carry most of the value |
| Hosting | Vercel | Free tier, and it provides the public HTTPS URL a Strava webhook needs |

Every component has a free tier; no credit card is required to run this.

## Architecture

```
Browser
  │
  ├── Server Components ──────▶ services/ ──▶ Drizzle ──▶ Neon Postgres
  │     (today, plan, calendar, link, progress, settings)
  │
  └── Route Handlers ────────▶ services/ ──▶ Drizzle ──▶ Neon Postgres
        /api/plans            │
        /api/plans/preview ───┘──▶ lib/plan-engine  (pure, no DB)
        /api/workouts/:id
        /api/link ────────────────▶ lib/matching    (pure, no DB)
```

```
src/
├── app/
│   ├── (app)/          today · plan · calendar · link · progress · settings
│   ├── (auth)/         sign-in · sign-up
│   ├── onboarding/     the six-step plan builder
│   └── api/            plans · workouts · link · auth
├── components/         ui · plan · workout · progress · nav · auth
├── lib/
│   ├── plan-engine/    ← PURE: no React, no database, no network
│   ├── matching/       ← PURE: activity-to-session scoring
│   ├── services/       the only place the engine meets the database
│   ├── db/             Drizzle schema, seed
│   └── auth · crypto · errors · rate-limit · units
└── middleware.ts       route guards
```

**The boundary that matters:** `src/lib/plan-engine/` may not import React,
Next, or the database. An ESLint rule enforces it. That is what lets the engine
— the most interesting part of the project — be tested without a browser or a
connection string, and it is why 53 of the 60 tests need no setup at all.

The engine pipeline:

```
PlanRequest
  → validate()            blocking errors vs overridable warnings
  → derivePaceZones()     Riegel equivalence → 8 training zones
  → buildPhases()         base / build / peak / taper
  → buildMileageCurve()   progression, cutbacks, taper, capped at the target
  → buildLongRunCurve()   capped by goal, by user limit, and by share of week
  → assignSessionSlots()  constraint-scored day placement
  → materialise()         templates → workouts with steps and pace targets
  → Plan
```

Deterministic by construction: no clock reads, no randomness, so the same
request always yields a byte-identical plan. That makes snapshot testing
possible and plan regeneration predictable.

## Local setup

Requires Node 20+ and a Postgres database (Neon's free tier works).

```bash
git clone https://github.com/shri771/Runna-Web.git
cd Runna-Web
npm install

cp .env.example .env.local        # then fill it in, see below
npm run db:migrate                # applies drizzle/0000_initial_schema.sql
npm run db:seed                   # optional: demo account with a half-marathon block

npm run dev                       # http://localhost:3000
```

```bash
npm test          # 60 unit tests
npm run lint      # includes the plan-engine purity rule
npm run typecheck
npm run build
```

> Neon free-tier databases auto-suspend when idle, so the first request after a
> quiet period takes roughly half a second longer. That is the database waking,
> not a bug.

## Environment variables

Copy `.env.example` to `.env.local`. Nothing here is committed.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Session signing key — `openssl rand -base64 32` |
| `AUTH_URL` | App origin, e.g. `http://localhost:3000` |
| `ENCRYPTION_KEY` | AES-256-GCM key for third-party tokens — `openssl rand -base64 32` |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | From strava.com/settings/api. Only needed once OAuth is built |
| `STRAVA_REDIRECT_URI` | OAuth callback |
| `STRAVA_VERIFY_TOKEN` | Any random string, for the webhook handshake |
| `CRON_SECRET` | Bearer token protecting `/api/cron/*` |

## Deployment

Not yet deployed. To deploy:

1. Create a **Neon** project and copy the pooled connection string.
2. Import the repo on **Vercel**.
3. Set every variable above in the Vercel project settings.
4. Deploy — `drizzle-kit migrate` runs as part of the build.
5. Run `npm run db:seed` against the production database so evaluators land on
   a working account rather than an empty one.

## Documentation

Full design specification in [`docs/`](docs/) — 20 documents covering the
product brief, every screen, the plan engine, the Strava integration, the data
model, the API contract, architecture, and error states. Start with
[`docs/README.md`](docs/README.md).

Design reasoning, including why the first visual pass was rejected, is in
[`docs/DESIGN-DIRECTION.md`](docs/DESIGN-DIRECTION.md).

---

Not affiliated with Runna or Strava. Built as an educational project.
