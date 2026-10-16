# Runna Web

A web-based running coach. Tell it your goal race, how often you can run and
how much you currently run; it generates a periodised training plan with
per-interval pace targets, lets you customise and rearrange it, links your
Strava activities back to the planned sessions, and tracks your progress
against the plan.

> Work in progress. Specification complete, project scaffolded, and the plan
> generation engine is built and tested. Screens are next.

## Documentation

Full specification in [`docs/`](./docs/) — start with the
[index](./docs/README.md).

| | |
|---|---|
| **What it is and for whom** | [Product Brief](./docs/01-product-brief.md) |
| **How each screen looks** | [Screen specs](./docs/screens/) (7 docs) |
| **The core algorithm** | [Plan Engine](./docs/04-plan-engine.md) |
| **Strava integration** | [Integration spec](./docs/05-strava-integration.md) |
| **How it's built** | [Architecture](./docs/08-architecture.md) · [Data Model](./docs/06-data-model.md) · [API](./docs/07-api-contract.md) |

## The five core workflows

1. **Create a plan** — answer six questions, see the mileage curve update live,
   generate ~60 structured workouts
2. **Customise and rearrange** — change your target weekly mileage mid-plan and
   preview the diff before committing; drag workouts between days
3. **Connect Strava** — activities sync in and auto-match to the workout they
   were meant to be, or link them by hand
4. **Execute the week** — today's session with full step breakdown and pace
   targets, completion tracking
5. **Track progress** — weekly volume trends, plan adherence, personal records

## Stack

Next.js 15 · TypeScript · Tailwind + shadcn/ui · Neon Postgres + Drizzle ·
Auth.js · Strava API · Vercel. Every component has a free tier.

## Local setup

```bash
cp .env.example .env.local   # fill in DATABASE_URL and the secrets
npm install
npm run db:generate          # already committed as drizzle/0000_initial_schema.sql
npm run db:migrate
npm run dev
```

```bash
npm test         # plan engine: 53 unit tests
npm run lint     # includes the plan-engine purity rule
npm run build
```

## Status

| Milestone | State |
|---|---|
| Design specification | done — 18 docs |
| Project scaffold | done — builds, lints, typechecks |
| Database schema | done — 17 tables, migration committed |
| **Plan engine** | **done — 53 tests passing** |
| Auth | not started |
| Screens | not started — routes stubbed |
| Strava integration | not started |
| Deployment | not started |

### What the plan engine already does

Takes a goal race, a date, available days and current fitness, and returns a
full periodised plan: base/build/peak/taper phases, a weekly volume curve that
respects the user's mileage ceiling with cutback weeks and a taper, a long-run
progression, constraint-based day scheduling (no two hard sessions back to
back), and 13 session templates rendered as structured steps with per-interval
pace targets derived from the runner's own race result via Riegel.

It is pure TypeScript — no database, no React, no network — enforced by an
ESLint rule, which is why it can be tested without either.

---

Not affiliated with Runna or Strava. Built as an educational project.
