# 08 — Architecture

Three constraints drove every choice here: it must **look good**, it must be
**realistic to build** in the time available, and every piece must have a
**free tier**. No part of this stack requires a credit card.

## 1. Stack

| Layer | Choice | Why this one | Cost |
|---|---|---|---|
| Framework | **Next.js 15**, App Router, TypeScript | One codebase for UI and API. Server Components mean most pages need no client-side data fetching at all. Deploys to Vercel with zero config. | Free |
| UI | **Tailwind CSS v4** + **shadcn/ui** + **lucide-react** | shadcn gives accessible Radix-based components you own as source, not a dependency. This is the single biggest lever on "looks good" per hour spent. | Free, MIT |
| Charts | **Recharts** | Covers both charts in the screenshots (plan overview bars, performance bars) without fighting a canvas library. | Free |
| Drag & drop | **dnd-kit** | Keyboard-accessible out of the box, which matters for the rearranging workflow. | Free |
| Motion | **Framer Motion** | Sheet transitions, progress animations. | Free |
| Database | **Neon Postgres** | Serverless Postgres, HTTP driver that works from Vercel functions without connection pooling pain. Branching is useful for testing migrations. | Free: 0.5GB, plenty |
| ORM | **Drizzle** | TypeScript-first, generates SQL migrations you can read and commit, no codegen step, very small runtime. | Free |
| Auth | **Auth.js v5 (NextAuth)** | Credentials provider for email/password, Drizzle adapter, HTTP-only cookie sessions. Self-hosted, no third-party identity service. | Free |
| Validation | **Zod** | One schema per boundary, shared between client form validation and server parsing. | Free |
| Background work | **Vercel Cron** (2 daily jobs) + `waitUntil()` for post-response processing | Avoids adding a queue service. Enough for token refresh, event sweeping and rollup recomputation. | Free |
| Testing | **Vitest** (unit) + **Playwright** (one E2E happy path) | The plan engine is pure functions, so unit tests carry most of the value. | Free |
| Hosting | **Vercel Hobby** | Public HTTPS URL — which the Strava webhook requires — preview deploys per branch, and CI on push. | Free |
| Error tracking | **Sentry** | Free tier is 5k errors/month. | Free |

### Why not the alternatives

- **Separate React SPA + Express API** — two deployments, CORS, duplicated
  types, and no server rendering. It buys a service boundary this app has no
  need for.
- **Supabase for auth + DB** — less code to write, but it moves the
  authorisation logic into RLS policies and away from the application. The
  rubric weighs *your* engineering logic, and auth is a visible chunk of it.
- **Prisma instead of Drizzle** — heavier runtime and a generate step that's
  awkward on serverless cold starts. Drizzle's output is also more readable in
  a code review.
- **Redis for rate limiting** — Upstash has a free tier, but one Postgres table
  does the job at this scale and is one fewer service to configure and explain.

## 2. Folder structure

```
runna-web/
├── docs/                          ← these documents
├── drizzle/                       ← committed SQL migrations
├── public/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx           landing
│   │   ├── (auth)/sign-in, sign-up
│   │   ├── (app)/                         authenticated shell + nav
│   │   │   ├── layout.tsx                 tab bar / sidebar
│   │   │   ├── today/, plan/, calendar/, progress/, settings/
│   │   │   └── workouts/[id]/
│   │   ├── onboarding/                    plan builder wizard
│   │   └── api/
│   │       ├── plans/, workouts/, activities/, progress/, me/
│   │       ├── integrations/strava/
│   │       ├── webhooks/strava/
│   │       └── cron/
│   ├── components/
│   │   ├── ui/                    shadcn primitives
│   │   ├── workout/               WorkoutChip, WorkoutCard, StepList
│   │   ├── plan/                  WeekStrip, PlanOverviewChart, StatRow
│   │   ├── calendar/              AgendaWeek, DraggableChip, DropDay
│   │   ├── progress/              PerformanceChart, PRBadge, PRGrid
│   │   └── common/                EmptyState, ErrorState, Skeletons
│   ├── lib/
│   │   ├── plan-engine/           ← PURE. no db, no react, no fetch
│   │   ├── strava/                client, oauth, webhook, matcher, compliance, prs
│   │   ├── db/                    schema.ts, index.ts, queries/, seed.ts
│   │   ├── services/              plan-service, workout-service, link-service
│   │   ├── auth.ts, crypto.ts, errors.ts, rate-limit.ts
│   │   ├── units.ts               km/mi + pace formatting, one place only
│   │   └── validation/            zod schemas shared client+server
│   └── types/
├── tests/
│   ├── unit/plan-engine/          golden snapshots + invariants
│   ├── unit/strava/               matcher scoring, Riegel, compliance
│   └── e2e/                       signup → plan → link → progress
├── .env.example
└── README.md
```

### The one rule that keeps this clean

**`lib/plan-engine/` may not import anything from `lib/db`, `next`, or `react`.**
Enforced by an ESLint `no-restricted-imports` rule. The engine takes plain
objects and returns plain objects; persistence is somebody else's problem. This
is what makes it testable without a database and reviewable as a self-contained
piece of work.

## 3. Request flow

### A read (Today page)
```
Browser → /today (RSC)
   middleware: session cookie valid?  → else redirect /sign-in
   server component awaits getTodayData(userId, date)
     ├─ db: active plan + current version
     ├─ db: workouts for the week
     ├─ db: links + activities
     └─ db: weekly_rollup (compute on miss)
   render HTML, stream it
   client components hydrate only for: week strip taps, completion toggle,
   insight carousel
```
No loading spinner on first paint, no client fetch waterfall, no API call. This
is the main reason for choosing a server-rendering framework.

### A write (link an activity)
```
Browser → POST /api/workouts/:id/link
   auth → requireOwnedWorkout(userId, id)        404 if not owned
   zod parse body                                422 on bad shape
   service.linkActivity()
     ├─ transaction:
     │    insert workout_activity_links          409 on unique violation
     │    update workout.status = COMPLETED
     │    compute compliance
     │    delete weekly_rollup for that week
     └─ commit
   revalidatePath('/today'), revalidatePath('/plan')
   200 → client replaces the optimistic state with the server truth
```

### An async event (Strava webhook)
```
Strava → POST /api/webhooks/strava
   validate subscription_id
   insert webhook_events (unique → duplicate deliveries are no-ops)
   return 200                                    ← within 2 seconds
   waitUntil(processEvent(id)):
       getValidAccessToken (refresh if near expiry)
       fetch activity detail
       upsert activity
       extractPersonalRecords
       autoMatch → link if confident
       invalidate rollup
       mark event DONE
   cron sweeps anything still PENDING after 10 minutes
```

## 4. State management

Deliberately minimal — no Redux, no Zustand.

| State | Where it lives |
|---|---|
| Server data | React Server Components + `revalidatePath` after mutations |
| Navigation state (date, week, tab, range) | URL search params |
| Optimistic mutations | `useOptimistic` for completion toggles and drag-drop |
| Form state | `react-hook-form` + Zod resolver (the 6-step wizard) |
| Ephemeral UI (sheets, menus) | Local `useState` |

The wizard is the only screen with meaningful client state, and it persists its
draft to `localStorage` so a refresh mid-signup doesn't lose the answers.

## 5. Security

| Concern | Measure |
|---|---|
| Passwords | bcrypt cost 12. Never logged, never returned. |
| Sessions | Auth.js JWT in an HTTP-only, `SameSite=Lax`, `Secure` cookie. 30-day rolling expiry. |
| Strava tokens | AES-256-GCM at rest, key in env. Decrypted only inside `lib/strava`. Never crosses the network boundary to the browser. |
| Authorisation | Every data access goes through a `requireOwned*` helper. Missing ownership = 404. |
| Input validation | Zod at every route boundary and every Server Action. |
| SQL injection | Drizzle parameterises everything; no raw string SQL. |
| CSRF | Auth.js tokens on auth routes; Server Actions have built-in origin checks; OAuth uses a `state` nonce. |
| Secrets | `.env.local` git-ignored, `.env.example` committed with empty values. Vercel env vars for production. A pre-commit hook runs `gitleaks` to block accidental commits. |
| Webhook forgery | `verify_token` handshake + `subscription_id` match + idempotency. |
| Rate limiting | Per-user and per-IP windows on auth, generation and sync. |
| Headers | CSP, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS via `next.config.ts`. |
| Dependencies | Dependabot + `npm audit` in CI. |

## 6. Performance

- **Rollup table** means Progress charts read one indexed row per week instead
  of aggregating thousands of activities.
- **Calendar paging** — `?from=&to=` fetches a 6-week window, infinite-scrolls
  in both directions rather than loading a full 52-week plan.
- **Preview caching** — `POST /api/plans/preview` responses are memoised by a
  hash of the request, so slider drags are cheap.
- **Indexes** on every foreign key plus `(plan_week_id, date)`,
  `(user_id, started_at desc)`, `(user_id, week_start)`.
- **Neon HTTP driver** — no connection pool exhaustion from serverless
  functions, which is the classic Postgres-on-serverless failure.
- Target: Lighthouse performance > 90 on `/today`, LCP < 2s on 4G.

## 7. Deployment

```
GitHub push
   ↓
GitHub Actions:  typecheck · lint · vitest · build
   ↓
Vercel:  preview deploy for every branch, production on main
   ↓
Neon:  `drizzle-kit migrate` as a build step
```

**Free-tier notes worth knowing before relying on them:**
- Vercel Hobby allows **2 cron jobs, daily frequency only** — which is why the
  design has exactly two daily jobs and leans on `waitUntil()` for anything
  that needs to happen sooner.
- Hobby serverless functions cap at **60s**; the backfill is batched and
  resumable so it never approaches that.
- Neon free-tier databases **auto-suspend after inactivity**; first request
  after idle takes ~500ms extra. Acceptable, and worth a note in the README so
  an evaluator's first click isn't mistaken for a bug.
- Hobby is **non-commercial use only** — fine for a student project.

### Environment variables

```bash
DATABASE_URL=                 # Neon pooled connection string
AUTH_SECRET=                  # openssl rand -base64 32
AUTH_URL=                     # https://<app>.vercel.app
ENCRYPTION_KEY=               # openssl rand -base64 32
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_VERIFY_TOKEN=
STRAVA_REDIRECT_URI=
CRON_SECRET=
SENTRY_DSN=                   # optional
```

## 8. Observability

- **Sentry** for exceptions, with the user id and route tagged.
- **Structured logs** — one JSON line per request: route, user, duration,
  outcome. Visible in Vercel's log drain.
- **An internal `/settings/debug` page** (own account only) showing Strava
  connection status, last 20 webhook events with their processing state, and
  rollup freshness. Cheap to build, and it makes the integration demonstrable
  in the video rather than invisible.
