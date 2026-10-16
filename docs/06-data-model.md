# 06 — Data Model

PostgreSQL (Neon free tier) via Drizzle ORM. Schema in `src/lib/db/schema.ts`,
migrations in `drizzle/` committed to git.

## Entity map

```
User ─┬─ AthleteProfile        (1:1)
      ├─ StravaConnection      (1:1)
      ├─ Activity              (1:N)
      ├─ PersonalRecord        (1:N)
      ├─ Notification          (1:N)
      ├─ WeeklyRollup          (1:N)
      └─ Plan                  (1:N, one ACTIVE at a time)
            ├─ PlanSettings    (1:1)
            └─ PlanVersion     (1:N)   ← Plan.currentVersionId points at one
                  └─ PlanWeek  (1:N)
                        └─ Workout (1:N)
                              └─ WorkoutActivityLink (0:1) ──▶ Activity
```

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext unique not null | |
| `password_hash` | text | bcrypt, cost 12. Null if OAuth-only |
| `name` | text | |
| `avatar_url` | text | |
| `units` | enum `KM`\|`MI` | default `KM` |
| `timezone` | text | IANA, e.g. `Asia/Kolkata`. Drives "today" |
| `created_at` / `updated_at` | timestamptz | |

Auth.js also owns `accounts`, `sessions`, `verification_tokens` — standard
adapter tables, not detailed here.

### `athlete_profiles`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid pk fk→users cascade | |
| `ability` | enum `BEGINNER`\|`INTERMEDIATE`\|`ADVANCED` | |
| `pace_basis_kind` | enum `RACE_RESULT`\|`ESTIMATED_5K`\|`EASY_PACE` | |
| `pace_basis_distance_m` | int | |
| `pace_basis_time_s` | int | |
| `estimated_5k_s` | int | derived via Riegel, cached |
| `weekly_km` | numeric(5,1) | self-reported at onboarding |
| `longest_run_km` | numeric(5,1) | |
| `date_of_birth` | date | optional, for HR zones later |

### `plans`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk→users cascade | |
| `goal` | enum `FIVE_K`\|`TEN_K`\|`HALF`\|`MARATHON`\|`BUILD_MILEAGE` | |
| `race_name` | text | nullable |
| `race_date` | date | null for `BUILD_MILEAGE` |
| `start_date` | date not null | |
| `total_weeks` | int not null | |
| `status` | enum `ACTIVE`\|`PAUSED`\|`COMPLETED`\|`ARCHIVED` | |
| `current_version_id` | uuid fk→plan_versions | nullable, set after first generate |

> **Invariant:** at most one `ACTIVE` plan per user. Enforced by a partial
> unique index: `create unique index on plans (user_id) where status = 'ACTIVE'`.

### `plan_settings`
One row per plan — the knobs on the Manage Plan screen.

| Column | Type | Notes |
|---|---|---|
| `plan_id` | uuid pk fk→plans cascade | |
| `days_per_week` | int | 2–7, checked |
| `preferred_days` | smallint[] | 0=Mon … 6=Sun |
| `long_run_day` | smallint | |
| `progression` | enum `GRADUAL`\|`STEADY`\|`AGGRESSIVE` | |
| `target_weekly_km` | numeric(5,1) | nullable = no ceiling |
| `max_easy_km` / `max_long_km` / `max_hard_km` | numeric(5,1) | nullable |
| `include_strength` | boolean | default false |

### `plan_versions`
Immutable snapshots. Regeneration inserts, never updates.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `plan_id` | uuid fk→plans cascade | |
| `version_no` | int | unique with `plan_id` |
| `reason` | enum `INITIAL`\|`SETTINGS_CHANGED`\|`RACE_MOVED`\|`REALIGNMENT`\|`MANUAL` | |
| `inputs_snapshot` | jsonb | the exact `PlanRequest` used — makes any plan reproducible |
| `total_distance_m` / `peak_weekly_m` | int | |
| `generated_at` | timestamptz | |

### `plan_weeks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `plan_version_id` | uuid fk cascade | |
| `week_no` | int | 1-based |
| `start_date` / `end_date` | date | |
| `phase` | enum `BASE`\|`BUILD`\|`PEAK`\|`TAPER`\|`RACE` | |
| `target_distance_m` | int | drives the Plan Overview bars |
| `is_cutback` / `is_taper` | boolean | |

### `workouts`
The busiest table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `plan_week_id` | uuid fk cascade | |
| `workout_key` | text | stable across regeneration: `w3-tue-tempo_2_1_1` |
| `date` | date not null | |
| `order_in_day` | smallint | default 0; a day can hold several |
| `type` | enum (see design system) | |
| `template_id` | text | `tempo_2_1_1`, `pyramid_intervals`, … |
| `name` | text | `Tempo 2-1-1` |
| `planned_distance_m` | int | |
| `est_duration_min_s` / `est_duration_max_s` | int | renders `40m – 45m` |
| `steps` | jsonb not null | nested `WorkoutStep[]`, Zod-validated on write |
| `status` | enum `SCHEDULED`\|`COMPLETED`\|`SKIPPED` | |
| `moved_from_date` | date | set when dragged, powers the `↷` badge |
| `is_extra` | boolean | user-added; excluded from plan adherence |
| `notes` | text | |

Indexes: `(plan_week_id, date)`, `(date)` for the calendar range query.

> **Why `steps` as jsonb rather than a table?** Steps are always read and
> written as a whole workout, never queried across workouts, and they're
> recursive (repeat blocks contain steps). A normalised table would need a
> self-referencing tree and buy nothing. The Zod schema at the write boundary
> gives the type safety a table would have provided.

### `activities`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk cascade | |
| `source` | enum `STRAVA`\|`MANUAL` | |
| `external_id` | text | Strava activity id; null for manual |
| `name` | text | |
| `sport_type` | text | |
| `started_at` / `started_at_local` | timestamptz / timestamp | local drives day matching |
| `distance_m` | int | |
| `moving_time_s` / `elapsed_time_s` | int | |
| `avg_pace_s_per_km` | int | generated: `moving_time_s * 1000 / distance_m` |
| `avg_hr` / `max_hr` | smallint | nullable |
| `elevation_gain_m` | int | |
| `map_polyline` | text | nullable, for the detail map |
| `laps` | jsonb | nullable, for per-rep compliance |
| `raw` | jsonb | the Strava payload, for debugging and reprocessing |

Unique: `(user_id, external_id)` where `external_id is not null` — the dedupe
guarantee. Index: `(user_id, started_at desc)`.

### `workout_activity_links`
| Column | Type | Notes |
|---|---|---|
| `workout_id` | uuid pk fk→workouts cascade | **one link per workout** |
| `activity_id` | uuid **unique** fk→activities cascade | **one link per activity** |
| `linked_by` | enum `AUTO`\|`USER` | |
| `match_score` | numeric(3,2) | nullable for manual links |
| `compliance` | enum `NAILED`\|`CLOSE`\|`OFF` | |
| `rep_analysis` | jsonb | per-lap breakdown where laps exist |
| `linked_at` | timestamptz | |

The two uniqueness constraints are what make the 409 conflicts in the API real
rather than advisory.

### `strava_connections`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid pk fk cascade | |
| `athlete_id` | bigint | |
| `access_token_enc` / `refresh_token_enc` | text | AES-256-GCM, never plaintext |
| `expires_at` | timestamptz | |
| `scopes` | text[] | |
| `status` | enum `ACTIVE`\|`REVOKED`\|`ERROR` | |
| `last_sync_at` | timestamptz | |
| `last_error` | text | |

### `webhook_events`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `provider` | text | `strava` |
| `object_type` / `object_id` / `aspect_type` | text / bigint / text | |
| `event_time` | timestamptz | |
| `payload` | jsonb | |
| `status` | enum `PENDING`\|`PROCESSING`\|`DONE`\|`FAILED` | |
| `attempts` | int | |
| `last_error` | text | |

Unique: `(provider, object_id, aspect_type, event_time)` — idempotency.
Index: `(status, created_at)` for the sweeper cron.

### `personal_records`
| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid fk cascade | |
| `distance_key` | text | `1K`, `1MI`, `5K`, `10K`, `HALF`, … |
| `time_s` | int | |
| `activity_id` | uuid fk→activities set null | |
| `achieved_at` | timestamptz | |
| `seen` | boolean | drives the "new PR" badge dot |

Primary key `(user_id, distance_key)` — one record per distance, upserted when
beaten.

### `weekly_rollups` — the cache
Recomputing eight weeks of chart data from raw activities on every Progress page
load is wasteful. This table is the materialised answer.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid fk cascade | |
| `week_start` | date | Monday, in the user's timezone |
| `actual_distance_m` / `actual_moving_time_s` / `activity_count` | int | |
| `planned_distance_m` / `planned_workouts` / `completed_workouts` | int | |
| `computed_at` | timestamptz | |

Primary key `(user_id, week_start)`. Invalidated (deleted) whenever an activity
or workout in that week changes; recomputed lazily on next read. Simple,
correct, and avoids a stale-cache class of bug entirely.

### `notifications`
`id`, `user_id`, `type` (`PR`, `STRAVA_REVOKED`, `PLAN_REALIGNMENT`,
`WORKOUT_AUTOLINKED`), `title`, `body`, `link_url`, `read_at`, `created_at`.

## Cross-cutting invariants

1. One `ACTIVE` plan per user — partial unique index.
2. One activity links to at most one workout, and vice versa — two unique
   constraints.
3. `workouts.steps` always validates against the Zod `WorkoutStep[]` schema; the
   only write path is through a function that parses first.
4. Sum of step distances equals `planned_distance_m` ± 50m — asserted in tests,
   not in the DB.
5. Every query filters by `user_id` (directly or through a verified join). There
   is one helper, `requireOwnedWorkout(userId, workoutId)`, and routes use it
   rather than hand-rolling the check.
6. Deleting a user cascades everything. Deleting a plan version cascades its
   weeks and workouts — which is why the *current* version is never deleted
   while referenced.

## Seed data

`src/lib/db/seed.ts` creates a demo account with a 12-week half-marathon plan
mid-way through, ~20 completed workouts, linked mock activities, and three
personal records — so the app is never evaluated against an empty database, and
so the demo video has something to show immediately.
