# Runna Web — Documentation

A web-based running coach. The user answers a handful of questions about their
goal and current fitness; the app **generates a periodised training plan**,
lets them **customise it** (weekly mileage, days per week, run-type caps),
**rearrange workouts**, **link completed Strava activities** to planned
sessions, and **track progress** against the plan.

These docs are the design spec written *before* implementation. Read them in
this order.

## Index

### Product
| Doc | What's in it |
|---|---|
| [01 — Product Brief](./01-product-brief.md) | Problem, target user, the 5 core workflows, scope boundaries |
| [02 — Information Architecture](./02-information-architecture.md) | Route map, navigation, responsive strategy |
| [03 — Design System](./03-design-system.md) | Colour tokens, workout colour coding, typography, components |

### Screens (layout + features, one doc each)
| Doc | Screen |
|---|---|
| [S1 — Auth & Plan Builder](./screens/01-auth-and-plan-builder.md) | Sign-up, the plan creation wizard, live preview |
| [S2 — Today](./screens/02-today.md) | Daily home, week strip, insights, record/complete |
| [S3 — Plan](./screens/03-plan.md) | Plan hero, overview chart, quick actions, Manage Plan, Rearrange |
| [S4 — Calendar](./screens/04-calendar.md) | Agenda view, week totals, drag-and-drop rearranging, add extra |
| [S5 — Workout Detail](./screens/05-workout-detail.md) | Step breakdown, pace targets, **Link Strava activity**, compliance |
| [S6 — Progress](./screens/06-progress.md) | Workouts / Performance tabs, charts, Personal Records |
| [S7 — Settings & Connections](./screens/07-settings.md) | Profile, units, Strava connect/disconnect, data export |
| [S8 — Link](./screens/08-link.md) | **Tracking**: reconcile Strava runs against planned workouts |

### Engineering
| Doc | What's in it |
|---|---|
| [04 — Plan Engine](./04-plan-engine.md) | The core algorithm: pace zones, phases, mileage curve, scheduling, templates, regeneration |
| [05 — Strava Integration](./05-strava-integration.md) | OAuth, token refresh, webhooks, auto-match scoring, PR extraction |
| [06 — Data Model](./06-data-model.md) | Tables, relationships, indexes, invariants |
| [07 — API Contract](./07-api-contract.md) | Every endpoint, request/response shapes, error codes |
| [08 — Architecture](./08-architecture.md) | Stack choices and why, folder structure, deployment, security |
| [09 — Error & Edge States](./09-error-states.md) | Loading / empty / error / conflict states per surface |
| [10 — Delivery Plan](./10-delivery-plan.md) | Milestones, commit strategy, rubric mapping |

## Stack at a glance

Chosen for three reasons: it looks good with little effort, it's realistic to
build in the time available, and **every piece has a free tier** — no credit
card anywhere in this stack.

| Layer | Choice | Free tier |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | — |
| UI | Tailwind v4 + shadcn/ui + lucide + Recharts + dnd-kit | MIT |
| Database | Neon Postgres + Drizzle ORM | 0.5 GB |
| Auth | Auth.js v5, credentials provider | self-hosted |
| Integration | Strava API (OAuth + webhooks) | 2,000 req/day |
| Hosting | Vercel Hobby — gives the public HTTPS URL the webhook needs | yes |
| Jobs | Vercel Cron (2 daily) + `waitUntil()` | yes |
| Tests | Vitest + one Playwright path | — |

Reasoning, including why not Supabase / Prisma / a separate API, is in
[08 — Architecture](./08-architecture.md).

## Reference screenshots

The target UI is in [`./example-layout/`](./example-layout/) — four screenshots
of the Runna mobile app:

| File | Screen |
|---|---|
| `...00.03.46.jpeg` | Today |
| `...00.03.30.jpeg` | Plan |
| `...00.03.21.jpeg` | Calendar |
| `...00.03.25.jpeg` | Progress → Performance |

The screenshots are **mobile**. This project is a **responsive web app**: every
screen doc specifies both the mobile layout (matching the screenshot) and the
desktop layout (≥1024px).

## The one-paragraph version

The interesting engineering is not CRUD on workouts. It is (a) a deterministic
**plan generation engine** that turns `{race, date, days/week, current fitness,
mileage cap}` into ~60 structured workouts with per-interval pace targets, (b)
**non-destructive regeneration** when the user changes their mind mid-plan, and
(c) a **two-way Strava pipeline** that matches real-world activities back onto
planned sessions and scores how well they were executed.
