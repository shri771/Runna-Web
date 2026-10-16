# 05 — Strava Integration

Requirement #2: *"on a specific workout, let the user link an activity through
Strava."* This doc covers the whole pipeline — connecting, ingesting, matching,
linking, and what falls out of it (completion, compliance, personal records).

Lives in `src/lib/strava/`.

## 0. Setup (free)

Register an application at <https://www.strava.com/settings/api>. Free, instant,
no review needed for personal use.

| Field | Value |
|---|---|
| Authorization Callback Domain | `localhost` in dev, `<app>.vercel.app` in prod |
| Scopes requested | `read,activity:read_all` |
| Client ID / Secret | → `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` |

Rate limits on the free tier: **200 requests / 15 min** and **2,000 / day**,
per application. Comfortable for this workload, but respected explicitly (§6).

## 1. OAuth connect

```
/settings/connections
   │ user clicks "Connect Strava"
   ▼
GET /api/integrations/strava/connect
   │ generate CSRF `state`, store in signed HTTP-only cookie (10 min TTL)
   ▼
302 → https://www.strava.com/oauth/authorize
         ?client_id=…&redirect_uri=…&response_type=code
         &approval_prompt=auto&scope=read,activity:read_all&state=…
   │ user approves on Strava
   ▼
GET /api/integrations/strava/callback?code=…&scope=…&state=…
   │ 1. verify `state` matches the cookie   → else 400 OAUTH_STATE_MISMATCH
   │ 2. verify `activity:read_all` granted  → else SCOPE_INSUFFICIENT, re-prompt
   │ 3. POST /oauth/token (grant_type=authorization_code)
   │ 4. encrypt access + refresh tokens, upsert StravaConnection
   │ 5. enqueue backfill job
   ▼
302 → /settings/connections?connected=1
```

The user may also land here from a post-onboarding prompt; `?next=` carries
them back to `/today` afterwards.

### Token storage

Tokens are credentials for a third-party account — they are **never** stored in
plaintext. `src/lib/crypto.ts` wraps Node's `crypto` with AES-256-GCM:

```ts
encrypt(plaintext): string   // "v1:<iv b64>:<authTag b64>:<ciphertext b64>"
decrypt(payload): string
```
Key from `ENCRYPTION_KEY` (32 random bytes, base64) in the environment — never
committed, set in the Vercel dashboard. Tokens are decrypted only inside the
Strava client, never returned by any API route, never sent to the browser.

### Token refresh

Access tokens expire 6 hours after issue. Handled in two places:

1. **Lazily**, in `getValidAccessToken(userId)` — if `expiresAt` is within 10
   minutes, refresh first. Every API call goes through this, so expiry is
   mostly invisible.
2. **Proactively**, by a daily Vercel Cron job that refreshes connections
   unused for >5 days, so a returning user's first request isn't slowed.

Strava issues a **new refresh token on every refresh** and invalidates the old
one, so the response must be persisted atomically. A failed refresh
(`invalid_grant` — user revoked access in Strava's settings) sets
`StravaConnection.status = 'REVOKED'`, raises a notification, and surfaces a
"Reconnect Strava" banner. It never hard-fails a page load.

## 2. Ingestion — two paths, one code path

Both end in the same function, so there is only one place where bugs can live:

```ts
ingestActivities(userId, activities: StravaActivity[]): IngestResult
```

### Path A — webhook (production, real-time)

Subscription created once per deployment:
```
POST https://www.strava.com/api/v3/push_subscriptions
  client_id, client_secret,
  callback_url = https://<app>.vercel.app/api/webhooks/strava,
  verify_token = <STRAVA_VERIFY_TOKEN>
```

```
GET  /api/webhooks/strava   ← Strava's validation handshake
     echo { "hub.challenge": <value> } if hub.verify_token matches

POST /api/webhooks/strava   ← event delivery
     { object_type: "activity", object_id, aspect_type: "create"|"update"|"delete",
       owner_id, subscription_id, updates }
```

Strava requires a **200 within 2 seconds** or it retries. So the handler does
the minimum: validate `subscription_id`, insert a `WebhookEvent` row, return
200. Processing happens after the response via `waitUntil()`, and a cron job
sweeps any rows left `PENDING`.

**Idempotency:** `WebhookEvent` has a unique index on
`(provider, objectId, aspectType, eventTime)`. Strava retries on timeout, so
duplicate deliveries are guaranteed; the unique index makes them free to ignore.

### Path B — manual sync (development, and a user-facing safety net)

`POST /api/integrations/strava/sync` pulls
`GET /athlete/activities?after=<epoch>&per_page=100`, paginated, filtered to
`sport_type` in `Run | TrailRun | VirtualRun`. Used for:
- the initial backfill on connect (`after = plan.startDate`),
- the "Sync now" button on `/settings/connections`,
- local development, where no public webhook URL exists.

This is why the integration demos reliably on a laptop without ngrok.

## 3. `ingestActivities()`

```
for each raw activity:
  1. skip if sport_type is not a run
  2. upsert Activity on unique (userId, externalId)   ← dedupe
  3. if newly created or distance/time changed:
       a. fetch detail GET /activities/{id} (for best_efforts + laps)
       b. extractPersonalRecords(activity)
       c. autoMatch(activity)
  4. invalidate WeeklyRollup for the affected week
```

Deleting an activity in Strava (`aspect_type: "delete"`) unlinks it from any
workout, reverts that workout to `SCHEDULED`, and recomputes rollups and PRs.

## 4. Auto-matching — activity → planned workout

The interesting bit. Given a run, decide which planned session it was.

```ts
candidates = workouts where
     abs(days(activity.startedAtLocal, workout.date)) <= 1
 and workout.status != 'COMPLETED'
 and workout has no linked activity
 and workout.type != 'REST'
```

Each candidate is scored 0–1:

```
dateScore     = same day ? 1.0 : 0.45
distanceScore = clamp(1 − |actualM − plannedM| / plannedM, 0, 1)
durationScore = clamp(1 − |actualS − estS|     / estS,     0, 1)
typeScore     = heuristic:
                  planned LONG       and actual is the week's longest  → 1.0
                  planned INTERVALS  and lap count >= 6                → 1.0
                  planned EASY       and avg pace within EASY zone     → 1.0
                  otherwise                                            → 0.5

score = 0.35·dateScore + 0.30·distanceScore
      + 0.20·durationScore + 0.15·typeScore
```

Decision:

| Condition | Outcome |
|---|---|
| `best >= 0.75` **and** `best − second >= 0.15` | **Auto-link.** `linkedBy = AUTO`, workout → `COMPLETED` |
| `best >= 0.45` | **Suggest.** Workout detail shows "Looks like this was *Morning Run, 6.1km*" with Confirm / Dismiss |
| otherwise | Activity stays unlinked, appears in the Link picker and in Progress as an extra run |

The `best − second` margin matters: on a day with two planned sessions (the
Saturday in the Calendar screenshot has both a 5km easy run and 10km mile
repeats), an ambiguous match must ask rather than guess wrong.

Auto-links are always reversible, and the UI says *why* it matched
("matched on date and distance, 0.91 confidence") so the behaviour isn't
magic the user can't argue with.

## 5. Manual linking — the required flow

```
/workouts/[id]
   │ "Link activity"
   ▼
Sheet: recent unlinked runs, ±7 days around the workout date, newest first
   ┌──────────────────────────────────────────────┐
   │ Morning Run            Fri 16 Oct, 06:42     │
   │ 6.12km · 31:48 · 5:12/km            [Link]   │
   ├──────────────────────────────────────────────┤
   │ Easy shakeout          Thu 15 Oct, 18:10     │
   │ 4.03km · 23:55 · 5:56/km            [Link]   │
   └──────────────────────────────────────────────┘
   │ "Show older" · "Enter manually" · "Sync now"
   ▼
POST /api/workouts/:id/link  { activityId }
   │ guards:
   │   - workout belongs to user              → 404
   │   - activity belongs to user             → 404
   │   - activity not already linked          → 409 ACTIVITY_ALREADY_LINKED
   │       with the conflicting workout, and a "Move it here" action
   │   - workout not already linked           → 409 WORKOUT_ALREADY_LINKED
   ▼
   create WorkoutActivityLink (linkedBy = USER)
   workout.status = COMPLETED
   computeCompliance()
   invalidate rollups
```

Unlink is `DELETE /api/workouts/:id/link` and reverts status to `SCHEDULED`.

**Manual entry fallback** — a user without Strava, or with a run recorded
somewhere that never reached Strava, can create an `Activity` with
`source = MANUAL` by entering distance, duration and date. Same link flow after
that. This keeps the whole app usable with zero integrations connected, which
also makes it demoable if Strava's API is down.

## 6. Rate limiting and resilience

- **Token bucket** in `src/lib/strava/limiter.ts`: 180 req / 15 min (90% of the
  limit, leaving headroom), persisted so serverless instances share a count.
- **Backoff** on `429`: respect `X-RateLimit-Usage`, retry with exponential
  delay + jitter, maximum 5 attempts, then park the job as `FAILED` with the
  error recorded.
- **Timeouts:** 10s per Strava call, `AbortController`-enforced.
- **Circuit breaker:** 5 consecutive 5xx responses opens the breaker for 5
  minutes; the UI shows "Strava sync paused, retrying shortly" instead of
  spinning forever.
- **Backfill batching:** 100 activities per page, 200ms between pages, capped
  at the plan's start date so a user with 10 years of history doesn't trigger a
  ban.

## 7. Compliance grading

Once linked, compare what was planned against what was run:

```
distanceRatio = actualM / plannedM
paceInRange   = avg pace within the dominant step's zone (±2%)

NAILED   distanceRatio within 0.97–1.03  and paceInRange
CLOSE    distanceRatio within 0.90–1.10
OFF      otherwise
```

Where Strava returns **laps**, interval sessions get a per-rep breakdown: each
lap is aligned to the corresponding `RUN` step and marked on-target, fast or
slow. That turns `Pyramid Intervals` from "done ✓" into "reps 1–4 on target,
rep 5 was 8s/km fast" — the thing that actually makes the app feel coached.

Stored on `WorkoutActivityLink` so the Progress → Workouts tab can filter by it.

## 8. Personal records

The detailed activity response includes `best_efforts[]` for runs — Strava's
own fastest splits for standard distances. For each of
`400m, 1/2 mile, 1K, 1 mile, 2 mile, 5K, 10K, 15K, 10 mile, 20K, half, 30K, marathon`:

```
upsert PersonalRecord (userId, distanceKey)
  where new.elapsedTime < existing.timeS
    → write, create a Notification, flag the Progress tab badge
```

If `best_efforts` is absent (manual activities, some uploads), fall back to a
sliding-window scan over the distance/time streams for the same distances.
If there are no streams either, the activity simply contributes no PRs.

This populates the hexagonal PR grid in the Progress screenshot directly.

## 9. Environment variables

```bash
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_VERIFY_TOKEN=          # any random string, for the webhook handshake
STRAVA_REDIRECT_URI=          # https://<app>.vercel.app/api/integrations/strava/callback
ENCRYPTION_KEY=               # base64 of 32 random bytes
```

All in `.env.local` (git-ignored) and in Vercel project settings.
`.env.example` is committed with empty values and a comment per line.

## 10. Disconnecting

`DELETE /api/integrations/strava`:
1. `POST https://www.strava.com/oauth/deauthorize` — revoke on Strava's side too,
   not just locally.
2. Delete `StravaConnection` (tokens gone).
3. **Keep** already-imported activities and links — the user's training history
   is theirs; deleting it on disconnect would be hostile. A separate
   "Delete imported activities" action exists, with a confirmation.
