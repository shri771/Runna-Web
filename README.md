# Runna Web

A web-based running coach. Tell it your goal race, how often you can run and
how much you currently run; it generates a periodised training plan with
per-interval pace targets, lets you customise and rearrange it, links your
Strava activities back to the planned sessions, and tracks your progress
against the plan.

> Work in progress. The design specification is complete; implementation is
> next.

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

## Status

| Milestone | State |
|---|---|
| Design specification | done |
| Project scaffold | not started |
| Plan engine | not started |
| Screens | not started |
| Strava integration | not started |
| Deployment | not started |

---

Not affiliated with Runna or Strava. Built as an educational project.
