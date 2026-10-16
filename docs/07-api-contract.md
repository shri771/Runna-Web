# 07 — API Contract

Next.js Route Handlers under `src/app/api/`. JSON in, JSON out. Mutations that
are initiated directly from a form use Server Actions instead, but every one of
them calls the same service function as the route handler, so there is a single
implementation per operation.

## Conventions

- All app routes require a session. Unauthenticated → `401 UNAUTHENTICATED`.
- Resources not owned by the caller return **`404`**, never `403` — we don't
  confirm that someone else's workout exists.
- Request bodies are parsed with Zod at the boundary. A parse failure is
  `422 VALIDATION_FAILED` with per-field messages.
- Dates are ISO `YYYY-MM-DD` (plan/workout dates, which are timezone-less) or
  RFC 3339 with offset (activity timestamps).
- Distances in **metres**, durations in **seconds**, paces in **seconds per
  kilometre**, always. Unit conversion happens in the UI layer only.

### Error envelope

```json
{
  "error": {
    "code": "ACTIVITY_ALREADY_LINKED",
    "message": "That activity is already linked to \"5km Easy Run\" on Sat 17 Oct.",
    "field": null,
    "details": { "workoutId": "…", "workoutName": "5km Easy Run" }
  }
}
```

`code` is a stable machine string the client switches on; `message` is
user-presentable; `details` carries whatever the UI needs to offer a recovery
action (here, a "Move it to this workout instead" button).

### Error codes

| Code | HTTP |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `NOT_FOUND` | 404 |
| `VALIDATION_FAILED` | 422 |
| `PLAN_ALREADY_ACTIVE` | 409 |
| `PLAN_GENERATION_FAILED` | 422 |
| `WORKOUT_ALREADY_LINKED` | 409 |
| `ACTIVITY_ALREADY_LINKED` | 409 |
| `INVALID_MOVE` | 422 |
| `STRAVA_NOT_CONNECTED` | 409 |
| `STRAVA_REVOKED` | 409 |
| `STRAVA_RATE_LIMITED` | 503 |
| `OAUTH_STATE_MISMATCH` | 400 |
| `SCOPE_INSUFFICIENT` | 400 |
| `RATE_LIMITED` | 429 |
| `INTERNAL` | 500 |

---

## Auth

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password, name }`. bcrypt cost 12. Password min 8 chars, checked against a short common-password list. Rate limited 5/hour/IP. Duplicate email returns a generic success to avoid account enumeration, and sends no email. |
| `*` | `/api/auth/[...nextauth]` | Auth.js: sign-in, sign-out, session, CSRF |

---

## Plans

### `POST /api/plans/preview`
Runs the engine **without persisting**. Powers the live preview in the wizard —
the user sees their mileage curve update as they drag the target slider.

```jsonc
// request: PlanRequest (see 04-plan-engine §1)
// 200
{
  "issues": [
    { "code": "RAMP_TOO_STEEP", "severity": "warning",
      "message": "Reaching 45km/week needs a 12% weekly increase.",
      "field": "targetWeeklyKm",
      "suggestions": [
        { "label": "Lower target to 38km", "patch": { "targetWeeklyKm": 38 } },
        { "label": "Use gradual progression", "patch": { "progression": "GRADUAL" } }
      ] }
  ],
  "summary": {
    "totalWeeks": 12, "totalDistanceM": 453000, "peakWeeklyM": 45000,
    "workoutCount": 60, "longestRunM": 19000,
    "weeks": [ { "weekNo": 1, "phase": "BASE", "targetDistanceM": 28000,
                 "isCutback": false, "sessions": ["EASY","TEMPO","EASY","LONG"] } ]
  },
  "paceZones": { "EASY": [345, 365], "THRESHOLD": [287, 295], "...": [] }
}
```

Blocking issues return `200` with `issues` populated and `summary: null` — the
wizard needs to render them, so they aren't an HTTP error.

Debounced 400ms client-side, and cached by a hash of the request body, so
dragging a slider doesn't hammer the server.

### `POST /api/plans`
Same body. Validates, generates, and persists `Plan` + `PlanSettings` +
`PlanVersion(1)` + weeks + workouts **in one transaction**. `409
PLAN_ALREADY_ACTIVE` if one exists (with an `archiveFirst: true` option to
replace it). Returns `201` with the plan id.

### `GET /api/plans/active`
The plan, its settings, current version, and aggregate progress
(`completedWorkouts`, `plannedWorkouts`, `completedDistanceM`, `totalDistanceM`,
`currentWeekNo`). Drives the Plan screen header and stat rows.

### `POST /api/plans/:id/preview-changes`
Body is a partial `PlanSettings`. Returns the `PlanDiff` (04-plan-engine §10)
**without writing**. This is the "41 workouts will change" confirmation.

### `POST /api/plans/:id/regenerate`
Body: partial settings + `confirm: true`. Applies it — inserts a new
`PlanVersion`, repoints `currentVersionId`, carries over completed workouts and
their links. Transactional. Returns the new version plus the applied diff.

### `POST /api/plans/:id/undo-regenerate`
Repoints `currentVersionId` back one version. Available for 24 hours.

### Other plan routes
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/plans/:id/weeks?from=&to=` | Weeks with nested workouts; the Calendar's paged fetch |
| `PATCH` | `/api/plans/:id` | Rename, move race date (triggers a diff preview first), pause/resume |
| `DELETE` | `/api/plans/:id` | Archives (soft). Hard delete only via Settings → Delete account |

---

## Workouts

| Method | Path | Body / notes |
|---|---|---|
| `GET` | `/api/workouts/:id` | Workout + resolved pace targets per step + linked activity + suggested match |
| `PATCH` | `/api/workouts/:id` | `{ status? , notes? , date? }`. Changing `date` runs move validation |
| `POST` | `/api/workouts` | Add an extra workout: `{ date, templateId, targetDistanceM }` → `isExtra = true` |
| `DELETE` | `/api/workouts/:id` | Only `isExtra` workouts are deletable; plan workouts are skipped, not deleted |
| `POST` | `/api/workouts/:id/move` | `{ toDate, force? }` — see below |
| `POST` | `/api/workouts/:id/link` | `{ activityId }` |
| `DELETE` | `/api/workouts/:id/link` | Unlink, revert to `SCHEDULED` |
| `POST` | `/api/workouts/:id/complete` | Manual completion without an activity: `{ actualDistanceM?, actualDurationS?, rpe? }` |

### `POST /api/workouts/:id/move`

```jsonc
// 200 — allowed
{ "ok": true, "workout": { }, "weekTotals": { "before": 37500, "after": 37500 } }

// 200 — allowed with a warning the user may override
{ "ok": true, "warnings": [
    { "code": "BACK_TO_BACK_HARD",
      "message": "This puts two hard sessions on consecutive days." } ] }

// 422 — rejected
{ "error": { "code": "INVALID_MOVE",
  "message": "Workouts can only move within one week of their planned date.",
  "details": { "earliest": "2026-10-09", "latest": "2026-10-23" } } }
```

Rules: within ±7 days · not onto a past date more than 1 day back · not past the
race date · max 3 workouts per day. `force: true` overrides warnings but never
errors.

---

## Activities

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/activities` | `?unlinked=true&around=<date>&window=7&limit=20&cursor=` — the Link Activity picker |
| `GET` | `/api/activities/:id` | Detail: splits, laps, HR, polyline |
| `POST` | `/api/activities` | Manual entry `{ name, startedAt, distanceM, movingTimeS }` → `source: MANUAL` |
| `DELETE` | `/api/activities/:id` | Manual activities only; Strava-sourced ones are removed by deleting in Strava |

Cursor pagination (`startedAt`, `id`) rather than offset — stable while new
activities arrive mid-scroll.

---

## Strava integration

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/integrations/strava/connect` | 302 to Strava with CSRF `state` |
| `GET` | `/api/integrations/strava/callback` | Token exchange, encrypt, store, enqueue backfill |
| `DELETE` | `/api/integrations/strava` | Deauthorize at Strava, then delete the connection |
| `GET` | `/api/integrations/strava/status` | `{ connected, athleteId, lastSyncAt, status, activityCount }` |
| `POST` | `/api/integrations/strava/sync` | Manual pull. Rate limited to 1/minute/user. Returns `{ imported, updated, autoLinked, skipped }` |
| `GET` | `/api/webhooks/strava` | Subscription handshake — echoes `hub.challenge` |
| `POST` | `/api/webhooks/strava` | Event intake. **Always 200 within 2s.** Persists then processes after the response |

The webhook route is the only unauthenticated mutating endpoint. It's protected
by matching `subscription_id` against the stored value, the unguessable
`verify_token` used at subscription time, and full idempotency on replay.

### `GET /api/link/inbox`
Backs the [Link tab](./screens/08-link.md) in one round trip.

```jsonc
{
  "connection": { "connected": true, "lastSyncAt": "2026-10-17T00:02:11Z",
                  "status": "ACTIVE" },
  "needsReview": [
    { "activity": { "id": "…", "name": "Morning Run", "startedAtLocal": "2026-10-16T06:42",
                    "distanceM": 6120, "movingTimeS": 1908, "avgPaceSPerKm": 312 },
      "suggestion": { "workoutId": "…", "name": "Tempo 2-1-1", "date": "2026-10-16",
                      "plannedDistanceM": 6000, "score": 0.91 } }
  ],
  "unlinkedActivities": [ /* … */ ],
  "waitingWorkouts":    [ /* past, SCHEDULED, unlinked */ ],
  "counts": { "needsReview": 2, "unlinked": 5, "waiting": 3 }
}
```

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/link/dismiss` | `{ activityId, workoutId }` — suppress one suggestion so it isn't re-proposed |
| `GET` | `/api/link/candidates?activityId=` | Ranked workouts for an activity |
| `GET` | `/api/link/candidates?workoutId=` | Ranked activities for a workout |

Linking itself reuses `POST /api/workouts/:id/link` — there is no second
implementation.

---

## Progress

### `GET /api/progress/summary?range=week|month|year&anchor=YYYY-MM-DD`
Served from `weekly_rollups`, recomputed lazily on miss.

```jsonc
{
  "range": { "from": "2026-10-12", "to": "2026-10-19", "label": "Oct 12 - Oct 19" },
  "totals": { "distanceM": 0, "movingTimeS": 0, "activityCount": 0 },
  "series": [ { "periodStart": "2026-08-24", "distanceM": 0 },
              { "periodStart": "2026-08-31", "distanceM": 0 },
              { "periodStart": "2026-09-07", "distanceM": 24100 } ],
  "comparison": { "previousDistanceM": 31200, "deltaPct": -22.8 }
}
```

### Other
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/progress/records` | All 13 distance keys, achieved or locked, with activity references |
| `GET` | `/api/progress/workouts?status=&compliance=&cursor=` | Completed sessions with compliance, for the Workouts tab |
| `GET` | `/api/progress/insights` | The Today-screen insight cards: mileage-on-track %, pace trend, consistency streak, next hard session |

---

## Settings

| Method | Path | Notes |
|---|---|---|
| `GET`/`PATCH` | `/api/me` | Profile: name, units, timezone, avatar |
| `PATCH` | `/api/me/password` | Requires current password |
| `GET`/`PATCH` | `/api/me/profile` | Athlete profile: ability, pace basis. Changing pace basis offers a regenerate |
| `GET` | `/api/me/export` | Full JSON export of plans, workouts, activities, records |
| `DELETE` | `/api/me` | Hard delete, cascades everything. Requires typing the email to confirm |
| `GET`/`POST` | `/api/notifications` | List / mark read |

---

## Cron (Vercel, free tier allows 2 daily jobs)

| Path | Schedule | Job |
|---|---|---|
| `/api/cron/daily` | `0 3 * * *` | Refresh stale Strava tokens · sweep `PENDING`/`FAILED` webhook events · recompute dirty rollups · detect 3+ missed sessions and raise a realignment notification |
| `/api/cron/weekly` | `0 4 * * 1` | Roll the plan week over · weekly summary notification · prune `webhook_events` older than 30 days |

Both guarded by a `CRON_SECRET` bearer token so they can't be triggered publicly.

## Rate limiting

A fixed-window counter keyed by `userId` or IP, stored in Postgres (no Redis
needed at this scale, and no paid service):

| Endpoint | Limit |
|---|---|
| `POST /api/auth/register` | 5 / hour / IP |
| Sign-in | 10 / hour / IP |
| `POST /api/plans/preview` | 60 / minute / user |
| `POST /api/plans`, `/regenerate` | 10 / hour / user |
| `POST /api/integrations/strava/sync` | 1 / minute / user |
| Everything else | 120 / minute / user |

Exceeded → `429` with a `Retry-After` header.
