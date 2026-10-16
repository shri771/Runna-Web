# 02 — Information Architecture

## Navigation model

The screenshots show a 5-tab mobile app: **Today · Plan · Calendar · Progress ·
Support**. We keep the first four, drop *Support* (a help-centre link, not
application functionality), and use the freed slot for **Link** — the Strava
reconciliation inbox, which is how tracking works in this app.

Final tab bar: **Today · Plan · Calendar · Link · Progress**. Settings lives
behind the avatar in the header, which is already present on every screen in
the reference screenshots.

```
┌─ Public ─────────────────────────────────────────────┐
│  /                 Landing (what it is, screenshots) │
│  /sign-in          Email + password                  │
│  /sign-up          Email + password                  │
└──────────────────────────────────────────────────────┘
                          │ authenticated
┌─ Onboarding (no plan yet) ───────────────────────────┐
│  /onboarding       6-step plan builder wizard        │
└──────────────────────────────────────────────────────┘
                          │ has an active plan
┌─ App shell (tabs) ───────────────────────────────────┐
│  /today            Daily home              [tab 1]   │
│  /plan             Plan overview           [tab 2]   │
│  /calendar         Agenda / rearranging    [tab 3]   │
│  /link             Link Strava runs        [tab 4]   │
│  /progress         Analytics + records     [tab 5]   │
│  /settings         Profile + integrations  (avatar)  │
└──────────────────────────────────────────────────────┘
┌─ Pushed routes (full page, with back) ───────────────┐
│  /workouts/[id]            Workout detail            │
│  /workouts/[id]/link       Link a Strava activity    │
│  /plan/manage              Manage plan (settings)    │
│  /plan/rearrange           Bulk schedule editor      │
│  /plan/guide               Plan guide / glossary     │
│  /plan/week/[n]            Single-week summary       │
│  /activities/[id]          Activity detail           │
│  /settings/connections     Connected apps            │
└──────────────────────────────────────────────────────┘
```

### Route guards

| Condition | Behaviour |
|---|---|
| Not authenticated, app route requested | Redirect `→ /sign-in?next=<path>` |
| Authenticated, no active plan | Redirect `→ /onboarding` from any tab |
| Authenticated, plan exists, at `/onboarding` | Redirect `→ /today` |
| Authenticated, at `/` or `/sign-in` | Redirect `→ /today` |
| Workout/activity not owned by user | `404`, never `403` — don't leak existence |

Implemented once in `middleware.ts` plus a server-side ownership check in every
data loader. Never trust the client for ownership.

## Tab bar / sidebar

| Tab | Icon | Route | Badge |
|---|---|---|---|
| Today | sun | `/today` | dot if today's workout incomplete |
| Plan | clipboard | `/plan` | — |
| Calendar | calendar | `/calendar` | — |
| Link | link-2 | `/link` | **count** of suggestions needing review |
| Progress | bar-chart | `/progress` | dot if new PR unseen |

Settings is reached from the avatar (top-left on every screen), badged when the
Strava token is revoked.

## Responsive strategy

The screenshots are mobile. Three breakpoints:

### Mobile `< 768px` — matches the screenshots
- Fixed bottom tab bar, 64px + safe-area inset.
- Single column, 16px gutters.
- Page header: avatar left, title centre, 1–2 actions right.
- Primary action as a floating pill above the tab bar (`Record workout`).

### Tablet `768–1023px`
- Bottom tab bar retained.
- Two-column grid where content allows (Plan overview + stat rows side by side).
- Max content width 720px, centred.

### Desktop `≥ 1024px`
- Bottom bar becomes a **240px fixed left sidebar**: logo, 5 nav items, user
  menu pinned to the bottom.
- Content max-width 1100px.
- Page header becomes an inline row at the top of the content column.
- Two-column layouts:

```
┌────────┬──────────────────────────────────────────────┐
│        │  Today                                       │
│  nav   │  ┌───────────────────┬────────────────────┐  │
│        │  │ Today's workout   │  Week strip        │  │
│  Today │  │ (steps expanded)  │  Week 2 overview   │  │
│  Plan  │  │                   │  Insights          │  │
│  Cal   │  └───────────────────┴────────────────────┘  │
│  Prog  │                                              │
│  Set   │                                              │
└────────┴──────────────────────────────────────────────┘
```

Calendar on desktop gains an optional **month grid** toggle alongside the
agenda list; the agenda remains the default because drag-and-drop targets are
larger and the week totals read better.

## Screen inventory

| # | Screen | Screenshot? | Core job |
|---|---|---|---|
| S1 | Plan Builder | no | Turn answers into a generated plan |
| S2 | Today | yes | What do I run today, and am I on track |
| S3 | Plan | yes | Shape of the whole block + entry to customisation |
| S4 | Calendar | yes | Browse and rearrange the schedule |
| S5 | Workout Detail | no | Execute one session; link the Strava activity |
| S6 | Progress | yes | Long-run trend and personal records |
| S7 | Settings | no | Profile, units, Strava connection |
| S8 | Link | no | Reconcile Strava runs against planned workouts |

## Primary user paths

```
First run
  /sign-up → /onboarding (6 steps) → preview → generate → /today
                                                   ↓
                                        prompt: Connect Strava →
                                        /settings/connections → OAuth → /today

Daily
  /today → tap workout → /workouts/[id] → run it →
     auto-linked by webhook  ─┐
     or "Link activity"      ─┴→ complete → back to /today (week bar advances)

Weekly
  /calendar → drag Thu intervals → Sat → confirm → totals recompute

Mid-plan change of mind
  /plan → Manage Plan → target mileage 40 → 32 → diff preview → commit
                                                      ↓
                                     new PlanVersion; weeks 1–4 frozen

Review
  /progress → Performance → view by Month → PR grid → tap 5K badge →
  /activities/[id]
```

## State that lives in the URL

Deep-linkable, shareable, and survives refresh:

| Param | Where | Example |
|---|---|---|
| `?date=` | Today, Calendar | `/today?date=2026-10-17` |
| `?week=` | Plan, Calendar | `/calendar?week=3` |
| `?tab=` | Progress | `/progress?tab=performance` |
| `?section=` | Link | `/link?section=review` |
| `?range=` | Progress | `/progress?range=month` |
| `?next=` | Sign-in | `/sign-in?next=/calendar` |

Everything else (open sheets, drag state, optimistic edits) is component state.
