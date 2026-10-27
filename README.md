# Runna Web

A running coach that builds your training plan around the distance you can
actually cover each week — and rebuilds it when that changes.

| | |
|---|---|
| **Live application** | **https://runna-web-mu.vercel.app** |
| **Demo video** | https://drive.google.com/file/d/1wWGoFMRrA9HVrS6z1Iiy9ILlw-Cl6RlM/view |
| **Repository** | https://github.com/shri771/Runna-Web |
| **Student** | Shrikant Shingare — 25BCS10641 |

**Try it without signing up:** `demo@runna.local` / `runna-demo-2026` — an
account six weeks into a twelve-week half marathon block, with completed
sessions, linked runs and personal records.

---

## Problem statement

Someone who signs up for a half marathon has two realistic options, and both
are bad.

A **free static PDF plan** does not know their current fitness, assumes they can
run on the days it prescribes, gives no pace targets, and the moment they miss
a week it is wrong and stays wrong. A **human coach** is correct and adaptive,
and costs more than £100 a month.

Almost every amateur runner lives in the gap between those. They also already
record their runs, but that data sits in a different app from the plan, so
nobody can answer *"am I actually on track?"* without building a spreadsheet.

## Target users

**Primary:** an amateur runner with a goal race 8–20 weeks away, running three
to five times a week, who wants structure without hiring a coach.

**Secondary:** a runner with no race who wants to build up to a distance or hold
a consistent weekly volume.

Deliberately **not** built for elite athletes or anyone wanting a social feed.

## Solution

**It generates a real plan.** Not a lookup table — a periodised block computed
from the runner's own inputs, with warm-ups, intervals, recoveries and
cool-downs, each step carrying a target pace range derived from a race they
have actually run.

**It stays the runner's plan.** Weekly mileage ceiling, days per week, long-run
day and progression rate are all theirs to set. The engine treats the mileage
target as a *ceiling, not a destination*: when the curve reaches it, the weeks
that follow get harder rather than longer.

**It closes the loop with what was actually run.** Recorded runs are scored
against the session they were meant to be, on date, distance and duration.
Completion, adherence and records all fall out of that.

---

## Key features

### The five core workflows

| # | Workflow | What the user does |
|---|---|---|
| 1 | **Create a plan** | Six-step wizard. Drag the mileage slider and twelve weeks of training reshape live, before anything is saved. |
| 2 | **Customise it** | Set the weekly ceiling, training days, long-run day and build rate; the engine warns when a target needs an unsafe ramp and offers one-tap fixes. |
| 3 | **Execute the week** | Today shows the session with its full step breakdown and pace targets, plus how to run it and why it is in the plan. |
| 4 | **Reconcile runs** | The Link tab scores runs against unmatched sessions, proposes the likely pairing, and handles the conflict when a run is already attached elsewhere. |
| 5 | **Track progress** | Weekly volume, plan adherence, per-session compliance grading and personal records across ten distances. |

### Everything else

- Email/password **and** Google sign-in, with route guards and per-resource ownership checks
- 13 parameterised session templates that scale to the week's volume
- Every workout drawn as its own **intensity silhouette**, computed from its steps
- Hand-logged runs, so the app is fully usable with no integration connected
- Strava authorisation hand-off (see [Honest status](#honest-status))
- Delete a plan and build a new one; activities survive, because they are the
  runner's record rather than the plan's

---

## Tech stack

| Layer | Choice | Why this one |
|---|---|---|
| Framework | **Next.js 15**, App Router, TypeScript | Server Components mean most pages need no client fetching; one repo, one deploy |
| Styling | **Tailwind v4**, Barlow Condensed + Inter | Condensed figures are the native typography of race results |
| Database | **Neon Postgres** + **Drizzle ORM** | Serverless Postgres over HTTP avoids pool exhaustion; migrations are readable SQL, committed to the repo |
| Auth | **Auth.js v5** — credentials + Google | Self-hosted, so the authorisation logic stays in the application rather than in a vendor's policy engine |
| Validation | **Zod** | One schema per boundary, shared by client and server |
| Testing | **Vitest** | The engine is pure functions, so unit tests carry most of the value |
| Hosting | **Vercel** | Free tier, preview deploys, and the public HTTPS URL an OAuth callback needs |

Every component has a free tier. No service here requires a card.

**Deliberately not used:** no Redis (one Postgres table does the rate limiting
at this scale), no component library (the design is specific enough that a kit
would have been fought rather than used), no state manager (URL params and
Server Components cover it).

---

## Architecture

### The shape of it

```
                          ┌──────────────────────────────┐
  Browser ───────────────▶│  Next.js (Vercel, sin1)      │
                          │                              │
                          │  middleware.ts ── route      │
                          │     guards, edge runtime     │
                          │              │               │
                          │   ┌──────────┴──────────┐    │
                          │   │                     │    │
                          │  Server            Route      │
                          │  Components        Handlers   │
                          │   │                     │    │
                          │   └──────────┬──────────┘    │
                          │              ▼               │
                          │         lib/services/        │
                          │   the only layer that talks  │
                          │   to both domain and storage │
                          │         │          │         │
                          │         ▼          ▼         │
                          │  lib/plan-engine  Drizzle    │
                          │  lib/matching       │        │
                          │   ← PURE: no DB,    │        │
                          │     no React        │        │
                          └─────────────────────┼────────┘
                                                ▼
                                       Neon Postgres (19 tables)
```

### The boundary that matters

**`src/lib/plan-engine/` may not import React, Next, or the database.** An
ESLint rule enforces it, and the rule is verified by deliberately violating it.

That is not decoration. The engine is the most interesting part of the project,
and keeping it pure means it can be tested without a browser, a server or a
connection string — which is why 53 of the 60 tests need no setup at all. The
same boundary applies to `lib/matching`, which was extracted precisely because
a failing test revealed it was unreachable while coupled to the database.

### How a plan is generated

```
PlanRequest
  → validate()            blocking errors vs overridable warnings
  → derivePaceZones()     Riegel equivalence → 8 training zones
  → buildPhases()         base / build / peak / taper
  → buildMileageCurve()   progression, cutback weeks, taper, capped at target
  → buildLongRunCurve()   capped by goal, by user limit, by share of week
  → assignSessionSlots()  constraint-scored day placement
  → materialise()         templates → workouts with steps and pace targets
  → balanceToTarget()     remainder spread across the easy runs
  → Plan
```

Every pace in the app derives from **one number**: an equivalent 5K time,
normalised from any input via Riegel's formula `T₂ = T₁ × (D₂/D₁)^1.06`. The
eight training zones are offsets from it, each a *range* rather than a single
number, which is what produces honest estimates like "40 – 45m" instead of
false precision.

Day placement is a small constraint solver: enumerate candidate arrangements,
score each against the training rules (no two quality sessions on consecutive
days, nothing hard the day before the long run, rest after the hardest day),
keep the best. With at most seven days the search space is tiny, so brute force
is both adequate and deterministic.

**The whole engine is deterministic** — no clock reads, no randomness — so the
same request always produces a byte-identical plan. That is what makes snapshot
testing possible and plan regeneration predictable.

### How a run is matched to a session

```
score = 0.40·date + 0.35·distance + 0.25·duration

  ≥ 0.75 and clear of the runner-up  → link automatically
  ≥ 0.45                             → propose, let the user confirm
  more than one day apart            → 0, whatever the distance says
```

### Data model

19 tables. The constraints worth naming are the ones that turn API conflicts
from advisory into real:

- a **partial unique index** giving each user at most one `ACTIVE` plan
- **one link per workout and one per activity**, so a run cannot silently
  satisfy two sessions — this is what produces the 409 and its "move it here"
  recovery
- `unique(user_id, external_id)` on activities, the import dedupe guarantee
- `unique(provider, object_id, aspect_type, event_time)` on webhook events, so
  a retried delivery is free to ignore

**Plan versions are immutable snapshots** carrying the exact request that
produced them, so any plan is reproducible from its row alone, and regeneration
can preserve completed history by pointing at a new version rather than
mutating the old one.

### Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt, cost 12, never logged or returned |
| Sessions | JWT in an HTTP-only, `SameSite=Lax`, Secure cookie |
| Third-party tokens | AES-256-GCM at rest, key from the environment |
| Authorisation | Every mutation joins the resource back to the user; someone else's resource is a **404, never a 403**, so existence is not confirmed |
| Account enumeration | Registration returns the same response whether or not the email exists; sign-in runs the hash comparison even for unknown users so timing does not leak |
| Input | Zod at every route boundary |
| SQL injection | Drizzle parameterises everything; no string-built SQL |
| Secrets | `.env*` git-ignored, `.env.example` committed empty, real values only in Vercel |
| Rate limiting | Per-user and per-IP windows on registration, sign-in, generation |

### Error handling

Every surface implements loading, empty, error and success states. Specifics
worth calling out:

- **Warnings are overridable; errors are not.** The 10%-per-week volume ramp is
  a warning with one-tap fixes, not a wall — the runner is told the injury risk
  and may proceed.
- **Optimistic updates roll back and say so.** Marking a session complete fills
  instantly; a failed write reverts it with an explanation, not silently.
- **Conflicts offer a way out.** Linking an already-attached run returns a 409
  naming the other session, with "move it here instead".
- **Invalid states are made unreachable** where possible: the longest-run slider
  maximum follows the weekly-distance slider, so the combination cannot be
  entered rather than being rejected later.

Full catalogue in [`docs/09-error-states.md`](docs/09-error-states.md).

---

## Honest status

Built and working: authentication, the plan engine, plan creation and
persistence, all six app screens on real data, run linking, and progress
tracking.

**Strava import is not finished.** The authorisation hand-off is implemented —
clicking Connect opens Strava's own consent screen — but the token exchange and
activity import are not, so nothing is stored. The callback says exactly that
and points at the hand-logged run form, which feeds the identical matcher. The
full design is in [`docs/05-strava-integration.md`](docs/05-strava-integration.md).

Also specified but not built: drag-and-drop rearranging, and the plan
regeneration diff. An evaluator finding these absent is better than one
discovering they were implied.

---

## Local setup

Requires Node 20+ and a Postgres database (Neon's free tier works).

```bash
git clone https://github.com/shri771/Runna-Web.git
cd Runna-Web
npm install

cp .env.example .env.local        # then fill it in, see below
npm run db:migrate                # applies drizzle/0000_initial_schema.sql
npm run db:seed                   # optional: the demo account

npm run dev                       # http://localhost:3000
```

```bash
npm test          # 60 unit tests
npm run lint      # includes the plan-engine purity rule
npm run typecheck
npm run build
```

> Neon free-tier databases suspend when idle, so the first request after a quiet
> period takes about half a second longer. That is the database waking, not a bug.

## Environment variables

Copy `.env.example` to `.env.local`. Nothing below is committed.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes | Session signing key — `openssl rand -base64 32` |
| `AUTH_URL` | yes | App origin. **In production this must be the deployment URL**, or every redirect points at localhost |
| `ENCRYPTION_KEY` | yes | AES-256-GCM key for third-party tokens — `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | no | Google OAuth client ID. Both Google vars must be set or the button is hidden |
| `AUTH_GOOGLE_SECRET` | no | Google OAuth client secret |
| `STRAVA_CLIENT_ID` | no | Falls back to Strava's login page when absent |
| `STRAVA_REDIRECT_URI` | no | OAuth callback |
| `CRON_SECRET` | no | Bearer token guarding `/api/cron/*` |

## Deployment

Live at **https://runna-web-mu.vercel.app**, on Vercel's free tier with the
database on Neon, both in Singapore so the app sits next to its data.

The build command is `drizzle-kit migrate && next build`, so a deploy applies
the schema before compiling. Migrations are tracked in a table, making repeat
deploys a no-op, and a failed migration fails the deploy rather than shipping a
schema the code does not match.

Step-by-step, including the Google setup, in [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Documentation

20 documents in [`docs/`](docs/) — product brief, a specification per screen,
the plan engine, the Strava design, data model, API contract, architecture and
error states. Start at [`docs/README.md`](docs/README.md).

Design reasoning, including why the first two visual passes were rejected and
how the palette was computed in OKLCH and contrast-checked, is in
[`docs/DESIGN-DIRECTION.md`](docs/DESIGN-DIRECTION.md).

## Originality

Built from scratch. The *product concept* is modelled on the Runna app, whose
screenshots informed the layout and information architecture, but no code,
asset or design file comes from it — the training-plan engine, matching
algorithm, data model and visual language are all original work for this
project. Not affiliated with Runna or Strava.

AI assistance was used throughout, as permitted, for code generation,
refactoring, documentation and debugging. Every engineering decision recorded in
`docs/` was made and justified deliberately rather than accepted by default.
