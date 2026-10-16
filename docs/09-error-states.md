# 09 — Error & Edge States

The brief calls this out explicitly, and it's where most projects lose marks:
the happy path works, everything else is a blank screen or a spinner that never
stops. The question to ask of every surface is **what can go wrong here?**

## 1. The four states, everywhere

Every list, card and page implements all four. No exceptions.

| State | Rule |
|---|---|
| **Loading** | A skeleton shaped like the real content, never a centred spinner. Server Components mean most pages skip this entirely on first paint. |
| **Empty** | Icon + one-line headline + one-line explanation + one primary action. Never "No data". |
| **Error** | What happened in plain language + what to do + a Retry that actually retries. Never a raw status code. |
| **Success** | The content, plus explicit confirmation for anything the user triggered. |

## 2. Empty states

| Surface | Headline | Action |
|---|---|---|
| Today, no plan | — | Redirected to `/onboarding` by middleware |
| Today, rest day | "Rest day. Recovery is training too." | Shows the next session |
| Calendar before plan start | "Your plan starts Mon 13 Oct" | Jump to start |
| Link picker, nothing nearby | "No unlinked runs near 16 Oct" | Sync Strava · Enter manually · Show older |
| Progress, no activities | "No runs yet" | Connect Strava · Log a run |
| Progress, zero-distance week | *Not an empty state* — renders zero bars with "Nothing logged this week yet". A zero week during a taper is information, not absence. |
| PR grid, nothing set | All 13 badges locked at 25% opacity | — |
| Notifications | "Nothing new" | — |
| Workouts tab, none complete | "Complete a workout to see it here" | Go to today |

## 3. Input validation

Caught at three layers: HTML attributes, Zod on the client via
`react-hook-form`, Zod again on the server. The client layer is a convenience;
the server layer is the one that counts.

| Input | Rule | Message |
|---|---|---|
| Email | format, unique | "That doesn't look like an email address" |
| Password | min 8, not common | "Use at least 8 characters" |
| Race date | future, within plan limits | "A half marathon plan needs at least 8 weeks. The earliest race date is 12 Dec." |
| Days per week | 2–7, ≤ selected days | "Pick at least 4 days to run" |
| Longest run | ≤ weekly distance | Slider max moves with the weekly value — the invalid state is unreachable |
| Target mileage | ≥ current | "Target can't be below what you already run" |
| Target mileage | ramp ≤ 10%/wk | **Warning**, with one-tap fixes |
| Manual activity | distance > 0, duration > 0, date not future | Field-level |
| Move workout | ±7 days | "Workouts can move up to a week either side. Pick a date between 9 and 23 Oct." |

**Warnings are overridable; errors are not.** The 10%/week ramp is a warning —
the user is told the risk, and may proceed.

## 4. Network and server failures

| Failure | Behaviour |
|---|---|
| Page data fetch fails | `error.tsx` boundary per route segment: "Couldn't load your plan" + Retry. The nav stays usable — a failed Progress page must not break Today. |
| Mutation fails | Optimistic update reverts, toast with the reason + Retry. Never a silent revert. |
| Request times out (10s) | Aborted, treated as a failure with "This is taking longer than expected" |
| 500 | Generic message, Sentry event, request id shown so it can be reported |
| Offline | Detected via `navigator.onLine` + fetch failure. Banner "You're offline — showing your last synced plan". Reads come from cache; writes queue in IndexedDB and flush on reconnect. Drag-and-drop disables with an explanation rather than failing silently. |
| Slow connection | Skeletons stay; no layout shift when content lands |

## 5. Concurrency and duplicates

Where most of the real bugs would be.

| Situation | Handling |
|---|---|
| Double-click Create plan | Button disables on submit; server enforces one `ACTIVE` plan per user via a partial unique index |
| Two tabs link different activities to one workout | Unique PK on `workout_activity_links.workout_id` → second gets `409`, UI refreshes to show the winner |
| Same activity linked to two workouts | Unique constraint on `activity_id` → `409` with a "Move it here instead" action |
| Strava delivers the same webhook twice | Unique `(provider, object_id, aspect_type, event_time)` → duplicate insert is a no-op |
| Activity arrives while the user is manually linking it | Picker refreshes; if the row vanished, "That run was just linked automatically" |
| Regenerate while a workout is being completed | Regeneration is one transaction and never touches completed workouts; the completion either lands first or targets a frozen row |
| Two regenerations at once | Advisory lock per plan id; the second waits, then re-previews against the new state |
| Clock skew / timezone | All day boundaries computed in the user's stored timezone, never the server's |

## 6. External API failures (Strava)

| Failure | Behaviour |
|---|---|
| OAuth denied by user | Return to `/settings/connections` with "Connection cancelled". Not an error. |
| `state` mismatch | `400`, connection refused, logged as a potential CSRF attempt |
| Insufficient scope | Explain which permission is needed and re-prompt |
| Token expired | Refreshed transparently before the call |
| Refresh fails (`invalid_grant`) | `status = REVOKED`, notification, persistent reconnect banner. Nothing else breaks. |
| `429` rate limited | Backoff with jitter, job re-queued, UI shows "Sync paused, retrying in 8 min" with a countdown |
| `5xx` | Retry ×3 with backoff; 5 consecutive failures opens the circuit breaker for 5 minutes |
| Malformed payload | Zod-parsed at the boundary; the event is marked `FAILED` with the error stored, and one bad activity never blocks the batch |
| Webhook delivery to a cold function | Row inserted and 200 returned before any processing — well inside the 2s budget |
| Strava entirely down | Everything except syncing keeps working. Manual activity entry is always available. |

**Principle:** a third-party outage degrades one feature. It never takes down
the app, and it is never a blank screen.

## 7. Plan engine failures

| Situation | Handling |
|---|---|
| Inputs produce an impossible plan | `validate()` catches it before generation and returns issues with suggested fixes |
| Nonsense pace basis (9-minute 5K) | Zones clamped to sane bounds, flagged as estimated |
| Generation throws unexpectedly | Transaction rolls back — no half-written plan. Error reported with the input snapshot attached, so it's reproducible from `inputs_snapshot` alone |
| Regeneration would delete completed work | Structurally impossible: weeks before `freezeBefore` are copied, never regenerated. Asserted in tests |
| Race moved to a date too close | Blocking issue with the earliest valid date offered |
| Race moved earlier than today | Offer to complete the plan instead |

## 8. Authorisation

| Attempt | Response |
|---|---|
| Unauthenticated app route | `302 → /sign-in?next=…` |
| Unauthenticated API call | `401` |
| Another user's workout/plan/activity | **`404`**, never `403` — existence isn't confirmed |
| Expired session mid-action | Mutation returns `401`, client shows a re-auth dialog and retries the action after sign-in |
| Cron route without the secret | `401` |
| Webhook with a wrong `subscription_id` | `200` (never leak to a prober) but discarded |

## 9. Destructive action confirmations

Every irreversible action states its consequences before it happens:

| Action | Confirmation |
|---|---|
| Delete account | Type the email to confirm; lists what's deleted |
| Archive plan | "Your history is kept. You can't edit it afterwards." |
| Disconnect Strava | Lists exactly what stops and what stays |
| Regenerate plan | Full diff preview; Undo available 24h |
| Delete an extra workout | Inline confirm; plan workouts can only be skipped, never deleted |

## 10. Testing the unhappy paths

Unit tests for every validation rule and every conflict code. Specific cases
worth naming:

- link an activity already linked elsewhere → `409` with the right `details`
- replay the same webhook twice → exactly one activity row
- revoke a token mid-sync → job parks, no data loss, banner appears
- regenerate with four completed weeks → those four are byte-identical after
- move a workout 10 days → `422` with the valid window in `details`
- create a second plan while one is active → `409`
- generate with `raceDate` 3 weeks out for a marathon → blocking issue, nothing
  written

Plus a Playwright run of the full happy path, and one deliberately broken path
(link a conflicting activity, recover via "Move it here").
