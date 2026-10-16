# 10 — Delivery Plan

Deadline: **27 October 2026, 11:59 PM IST**. Today is 17 October — **10 days**.
That constraint shapes the ordering below: the three evaluated workflows get
built first, polish comes last, and nothing on the critical path depends on a
paid service.

## Principle

Ship a **thin vertical slice early**, then deepen. By end of day 3 there should
be a deployed URL where you can sign up, generate a plan, and see it. Everything
after that is improvement to a thing that already works, not a race to make
anything work at all.

## Milestones

### M1 — Foundations (day 1)
- `create-next-app`, TypeScript, Tailwind v4, shadcn init, ESLint + Prettier
- Neon project, `DATABASE_URL`, Drizzle schema for `users` / `plans` /
  `plan_versions` / `plan_weeks` / `workouts`, first migration
- Auth.js credentials provider, sign-up / sign-in, `middleware.ts` route guards
- **Deploy to Vercel on day 1**, with the database connected
- `.env.example`, README skeleton

*Done when:* you can sign up on the deployed URL and reach an empty `/today`.

### M2 — Plan engine (days 2–3) — the critical path
Build this **before any UI that depends on it**. It's pure TypeScript, so it's
developed against tests rather than a browser.

- `types.ts`, `validate.ts`, `paces.ts` (Riegel + zones), `phases.ts`,
  `mileage.ts`, `longrun.ts`, `schedule.ts`
- ~11 workout templates in `templates/`
- `materialise.ts`, `generate.ts`
- Vitest: golden snapshots for 6 canonical requests + the invariant suite

*Done when:* `generate()` produces a full 12-week half-marathon plan and every
invariant test passes. No UI yet.

### M3 — Plan builder + Today + Calendar (days 4–5)
- 6-step wizard with `POST /api/plans/preview` live preview
- `POST /api/plans` persisting in one transaction
- Today: week strip, workout card, week overview, completion toggle
- Calendar: agenda list, week totals, workout chips
- Workout detail: step list with pace targets
- Design system tokens and the shared components from doc 03

*Done when:* **workflow W1 and W4 work end-to-end on the deployed URL.**

### M4 — Strava (days 6–7)
- Register the Strava app, OAuth connect/callback, AES-GCM token storage
- `getValidAccessToken()` with lazy refresh
- Backfill + `POST /sync`, `ingestActivities()`
- Webhook route (handshake, idempotent intake, `waitUntil` processing)
- Auto-matcher + compliance grading
- **Manual link flow on workout detail** — the explicitly required feature
- PR extraction from `best_efforts`

*Done when:* **workflow W3 works** — a run uploaded to Strava appears in the app
and attaches itself to the right workout, and the manual picker works too.

### M5 — Customisation + Progress (day 8)
- Manage Plan, `preview-changes` diff sheet, `regenerate` with undo
- Drag-and-drop rearranging in the Calendar with move validation
- Progress: both tabs, rollup table, chart, PR grid

*Done when:* **workflows W2 and W5 work.** All five are now complete.

### M6 — Hardening (day 9)
- Every empty / loading / error state from doc 09
- Rate limiting, Sentry, security headers
- Seed script + demo account
- Playwright happy path, plus the conflict-recovery path
- Accessibility pass: focus rings, keyboard drag, contrast, reduced motion
- Lighthouse pass on `/today`

### M7 — Submission (day 10)
- README to the required structure (doc 13 of the brief)
- Architecture diagram
- Demo video, 3–5 minutes
- Verify every link in an incognito window
- Submit the form

## Buffer

Days 2–3 (the engine) and 6–7 (Strava) are the two places this can slip. If it
does:

| Cut, in this order | Why it's safe |
|---|---|
| Month view on desktop Calendar | Agenda already does the job |
| Pace insights panel | Nice-to-have analysis |
| Per-rep lap analysis | Compliance grading still works at the session level |
| `/settings/debug` | Internal only |
| Webhook → fall back to "Sync now" + cron | Same user-facing feature, less real-time |

**Never cut:** the plan engine, manual Strava linking, the diff-preview
regeneration, or the error states. Those are the four things the rubric
actually rewards.

## Git strategy

The brief explicitly warns against a single final upload. Commit continuously,
in small meaningful units.

- Conventional commits: `feat(plan-engine): add Riegel pace equivalence`
- One branch per milestone (`feat/plan-engine`), PR into `main`, squash-merge.
  Vercel builds a preview per branch for free.
- Expect 80–120 commits across 10 days.
- `.gitignore` covers `.env*`, `.next`, `node_modules`. `gitleaks` pre-commit
  hook so a secret can't land even once — a secret in history counts as exposed
  even after deletion.
- Tag `v1.0.0` at submission.

## Rubric mapping

| Area | % | Where it's earned |
|---|---|---|
| Problem & Product Understanding | 10 | [01 — Product Brief](./01-product-brief.md): named user, five workflows, explicit non-goals |
| Core Product Implementation | 25 | All five workflows complete, M3–M5 |
| Engineering & Application Logic | 20 | [04 — Plan Engine](./04-plan-engine.md) — periodisation, pace derivation, constraint-based scheduling, non-destructive regeneration. [05](./05-strava-integration.md) — auto-match scoring, compliance grading |
| Architecture & Technical Decisions | 15 | [08 — Architecture](./08-architecture.md): each choice justified, alternatives rejected with reasons, the pure-engine boundary |
| User Experience & Reliability | 10 | [03 — Design System](./03-design-system.md) + [09 — Error States](./09-error-states.md): four states everywhere, optimistic UI, offline handling |
| Code Quality & Project Structure | 10 | Pure engine with no framework imports, service layer, shared Zod schemas, ~60 unit tests |
| Deployment & Documentation | 10 | Vercel URL, seeded demo account, these 17 docs, README |

## What to show in the demo video (3–5 min)

Lead with the thing nothing else does.

| Time | Content |
|---|---|
| 0:00–0:30 | The problem: a static PDF plan that can't adapt |
| 0:30–1:30 | **Plan builder.** Drag the mileage slider, watch 12 weeks of training reshape live. This is the strongest 60 seconds in the product. |
| 1:30–2:15 | Today + workout detail: the session broken into steps with real pace targets |
| 2:15–3:00 | **Strava.** Connect, a run appears, auto-links to the right workout, compliance grade and per-rep breakdown |
| 3:00–3:45 | **Manage Plan.** Drop the target from 45 to 32 km, show the before/after diff, apply, show that completed weeks are untouched |
| 3:45–4:15 | Calendar drag-and-drop + Progress and PRs |
| 4:15–4:30 | Deployed URL, repo, tech stack |

Almost no code on screen. Show the product working.

## Definition of done

- [ ] Five workflows work end-to-end on the deployed URL
- [ ] Demo account seeded, reachable from the landing page
- [ ] Plan engine covered by snapshot + invariant tests
- [ ] Every surface has loading / empty / error states
- [ ] No secrets anywhere in git history
- [ ] README matches the brief's required structure
- [ ] Links verified in an incognito window
- [ ] Submission form completed
