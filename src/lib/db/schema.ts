/**
 * Drizzle schema. See docs/06-data-model.md for the reasoning behind each
 * table, especially why `workouts.steps` is jsonb and why `weekly_rollups`
 * exists as a cache.
 */

import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { WorkoutStep } from '@/lib/plan-engine/types'

// ----------------------------------------------------------------- enums

export const unitsEnum = pgEnum('units', ['KM', 'MI'])
export const abilityEnum = pgEnum('ability', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
export const paceBasisEnum = pgEnum('pace_basis_kind', ['RACE_RESULT', 'ESTIMATED_5K', 'EASY_PACE'])
export const goalEnum = pgEnum('goal', ['FIVE_K', 'TEN_K', 'HALF', 'MARATHON', 'BUILD_MILEAGE'])
export const planStatusEnum = pgEnum('plan_status', ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
export const progressionEnum = pgEnum('progression', ['GRADUAL', 'STEADY', 'AGGRESSIVE'])
export const versionReasonEnum = pgEnum('version_reason', [
  'INITIAL',
  'SETTINGS_CHANGED',
  'RACE_MOVED',
  'REALIGNMENT',
  'MANUAL',
])
export const phaseEnum = pgEnum('phase', ['BASE', 'BUILD', 'PEAK', 'TAPER', 'RACE'])
export const workoutTypeEnum = pgEnum('workout_type', [
  'RECOVERY',
  'EASY',
  'LONG',
  'TEMPO',
  'THRESHOLD',
  'INTERVALS',
  'RACE_PACE',
  'RACE',
  'REST',
])
export const workoutStatusEnum = pgEnum('workout_status', ['SCHEDULED', 'COMPLETED', 'SKIPPED'])
export const activitySourceEnum = pgEnum('activity_source', ['STRAVA', 'MANUAL'])
export const linkedByEnum = pgEnum('linked_by', ['AUTO', 'USER'])
export const complianceEnum = pgEnum('compliance', ['NAILED', 'CLOSE', 'OFF'])
export const connectionStatusEnum = pgEnum('connection_status', ['ACTIVE', 'REVOKED', 'ERROR'])
export const webhookStatusEnum = pgEnum('webhook_status', ['PENDING', 'PROCESSING', 'DONE', 'FAILED'])
export const notificationTypeEnum = pgEnum('notification_type', [
  'PR',
  'STRAVA_REVOKED',
  'PLAN_REALIGNMENT',
  'WORKOUT_AUTOLINKED',
  'WEEKLY_SUMMARY',
])

// ----------------------------------------------------------------- users

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  image: text('avatar_url'),
  units: unitsEnum('units').notNull().default('KM'),
  timezone: text('timezone').notNull().default('UTC'),
  weekStartsOn: smallint('week_starts_on').notNull().default(0), // 0 = Monday
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Auth.js adapter tables. */
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
)

// ------------------------------------------------------- athlete profile

export const athleteProfiles = pgTable('athlete_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  ability: abilityEnum('ability').notNull().default('INTERMEDIATE'),
  paceBasisKind: paceBasisEnum('pace_basis_kind'),
  paceBasisDistanceM: integer('pace_basis_distance_m'),
  paceBasisTimeS: integer('pace_basis_time_s'),
  estimated5kS: integer('estimated_5k_s'),
  weeklyKm: numeric('weekly_km', { precision: 5, scale: 1 }).notNull().default('0'),
  longestRunKm: numeric('longest_run_km', { precision: 5, scale: 1 }).notNull().default('0'),
  dateOfBirth: date('date_of_birth'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ----------------------------------------------------------------- plans

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    goal: goalEnum('goal').notNull(),
    raceName: text('race_name'),
    raceDate: date('race_date'),
    startDate: date('start_date').notNull(),
    totalWeeks: integer('total_weeks').notNull(),
    status: planStatusEnum('status').notNull().default('ACTIVE'),
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one active plan per user.
    uniqueIndex('plans_one_active_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('plans_user_idx').on(t.userId),
  ],
)

export const planSettings = pgTable('plan_settings', {
  planId: uuid('plan_id').primaryKey().references(() => plans.id, { onDelete: 'cascade' }),
  daysPerWeek: smallint('days_per_week').notNull(),
  preferredDays: smallint('preferred_days').array().notNull(),
  longRunDay: smallint('long_run_day').notNull(),
  progression: progressionEnum('progression').notNull().default('STEADY'),
  targetWeeklyKm: numeric('target_weekly_km', { precision: 5, scale: 1 }),
  maxEasyKm: numeric('max_easy_km', { precision: 5, scale: 1 }),
  maxLongKm: numeric('max_long_km', { precision: 5, scale: 1 }),
  maxHardKm: numeric('max_hard_km', { precision: 5, scale: 1 }),
  includeStrength: boolean('include_strength').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const planVersions = pgTable(
  'plan_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    reason: versionReasonEnum('reason').notNull().default('INITIAL'),
    /** The exact PlanRequest used — makes any plan reproducible from the row. */
    inputsSnapshot: jsonb('inputs_snapshot').notNull(),
    totalDistanceM: integer('total_distance_m').notNull().default(0),
    peakWeeklyM: integer('peak_weekly_m').notNull().default(0),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('plan_versions_plan_no').on(t.planId, t.versionNo)],
)

export const planWeeks = pgTable(
  'plan_weeks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
    weekNo: integer('week_no').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    phase: phaseEnum('phase').notNull(),
    targetDistanceM: integer('target_distance_m').notNull(),
    isCutback: boolean('is_cutback').notNull().default(false),
    isTaper: boolean('is_taper').notNull().default(false),
  },
  (t) => [
    unique('plan_weeks_version_no').on(t.planVersionId, t.weekNo),
    index('plan_weeks_version_idx').on(t.planVersionId),
  ],
)

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planWeekId: uuid('plan_week_id').notNull().references(() => planWeeks.id, { onDelete: 'cascade' }),
    /** Stable across regeneration, e.g. `w3-tue-tempo_2_1_1`. */
    workoutKey: text('workout_key').notNull(),
    date: date('date').notNull(),
    orderInDay: smallint('order_in_day').notNull().default(0),
    type: workoutTypeEnum('type').notNull(),
    templateId: text('template_id').notNull(),
    name: text('name').notNull(),
    plannedDistanceM: integer('planned_distance_m').notNull(),
    estDurationMinS: integer('est_duration_min_s').notNull(),
    estDurationMaxS: integer('est_duration_max_s').notNull(),
    steps: jsonb('steps').$type<WorkoutStep[]>().notNull(),
    status: workoutStatusEnum('status').notNull().default('SCHEDULED'),
    movedFromDate: date('moved_from_date'),
    isExtra: boolean('is_extra').notNull().default(false),
    notes: text('notes'),
    rpe: smallint('rpe'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workouts_week_date_idx').on(t.planWeekId, t.date),
    index('workouts_date_idx').on(t.date),
  ],
)

// ------------------------------------------------------------ activities

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    source: activitySourceEnum('source').notNull(),
    externalId: text('external_id'),
    name: text('name').notNull(),
    sportType: text('sport_type').notNull().default('Run'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    startedAtLocal: timestamp('started_at_local').notNull(),
    distanceM: integer('distance_m').notNull(),
    movingTimeS: integer('moving_time_s').notNull(),
    elapsedTimeS: integer('elapsed_time_s').notNull(),
    avgPaceSPerKm: integer('avg_pace_s_per_km').notNull(),
    avgHr: smallint('avg_hr'),
    maxHr: smallint('max_hr'),
    elevationGainM: integer('elevation_gain_m'),
    mapPolyline: text('map_polyline'),
    laps: jsonb('laps'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The dedupe guarantee: one row per Strava activity per user.
    uniqueIndex('activities_user_external')
      .on(t.userId, t.externalId)
      .where(sql`${t.externalId} is not null`),
    index('activities_user_started_idx').on(t.userId, t.startedAt.desc()),
  ],
)

export const workoutActivityLinks = pgTable('workout_activity_links', {
  workoutId: uuid('workout_id').primaryKey().references(() => workouts.id, { onDelete: 'cascade' }),
  // One activity can satisfy at most one workout.
  activityId: uuid('activity_id').notNull().unique().references(() => activities.id, { onDelete: 'cascade' }),
  linkedBy: linkedByEnum('linked_by').notNull(),
  matchScore: numeric('match_score', { precision: 3, scale: 2 }),
  compliance: complianceEnum('compliance'),
  repAnalysis: jsonb('rep_analysis'),
  linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Suggestions the user rejected, so the matcher stops proposing them. */
export const dismissedMatches = pgTable(
  'dismissed_matches',
  {
    activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
    workoutId: uuid('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.workoutId] })],
)

// ------------------------------------------------------------ integrations

export const stravaConnections = pgTable('strava_connections', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  athleteId: bigint('athlete_id', { mode: 'number' }).notNull(),
  athleteName: text('athlete_name'),
  /** AES-256-GCM. Never stored or transmitted in plaintext. */
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  scopes: text('scopes').array().notNull(),
  status: connectionStatusEnum('status').notNull().default('ACTIVE'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  autoLink: boolean('auto_link').notNull().default(true),
  sameDayOnly: boolean('same_day_only').notNull().default(false),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
})

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull().default('strava'),
    objectType: text('object_type').notNull(),
    objectId: bigint('object_id', { mode: 'number' }).notNull(),
    aspectType: text('aspect_type').notNull(),
    ownerId: bigint('owner_id', { mode: 'number' }),
    eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Strava retries on timeout; this makes duplicate deliveries free to ignore.
    unique('webhook_events_idempotency').on(t.provider, t.objectId, t.aspectType, t.eventTime),
    index('webhook_events_status_idx').on(t.status, t.createdAt),
  ],
)

// ------------------------------------------------------------- analytics

export const personalRecords = pgTable(
  'personal_records',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    distanceKey: text('distance_key').notNull(),
    timeS: integer('time_s').notNull(),
    activityId: uuid('activity_id').references(() => activities.id, { onDelete: 'set null' }),
    achievedAt: timestamp('achieved_at', { withTimezone: true }).notNull(),
    seen: boolean('seen').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.distanceKey] })],
)

/** Materialised weekly totals. Deleted on change, recomputed lazily on read. */
export const weeklyRollups = pgTable(
  'weekly_rollups',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    actualDistanceM: integer('actual_distance_m').notNull().default(0),
    actualMovingTimeS: integer('actual_moving_time_s').notNull().default(0),
    activityCount: integer('activity_count').notNull().default(0),
    plannedDistanceM: integer('planned_distance_m').notNull().default(0),
    plannedWorkouts: integer('planned_workouts').notNull().default(0),
    completedWorkouts: integer('completed_workouts').notNull().default(0),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt.desc())],
)

/** Fixed-window rate limiting. Postgres is enough at this scale; no Redis. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
)

// ------------------------------------------------------------- relations

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(athleteProfiles, { fields: [users.id], references: [athleteProfiles.userId] }),
  strava: one(stravaConnections, { fields: [users.id], references: [stravaConnections.userId] }),
  plans: many(plans),
  activities: many(activities),
  records: many(personalRecords),
}))

export const plansRelations = relations(plans, ({ one, many }) => ({
  user: one(users, { fields: [plans.userId], references: [users.id] }),
  settings: one(planSettings, { fields: [plans.id], references: [planSettings.planId] }),
  versions: many(planVersions),
}))

export const planVersionsRelations = relations(planVersions, ({ one, many }) => ({
  plan: one(plans, { fields: [planVersions.planId], references: [plans.id] }),
  weeks: many(planWeeks),
}))

export const planWeeksRelations = relations(planWeeks, ({ one, many }) => ({
  version: one(planVersions, { fields: [planWeeks.planVersionId], references: [planVersions.id] }),
  workouts: many(workouts),
}))

export const workoutsRelations = relations(workouts, ({ one }) => ({
  week: one(planWeeks, { fields: [workouts.planWeekId], references: [planWeeks.id] }),
  link: one(workoutActivityLinks, { fields: [workouts.id], references: [workoutActivityLinks.workoutId] }),
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  link: one(workoutActivityLinks, { fields: [activities.id], references: [workoutActivityLinks.activityId] }),
}))

export const linkRelations = relations(workoutActivityLinks, ({ one }) => ({
  workout: one(workouts, { fields: [workoutActivityLinks.workoutId], references: [workouts.id] }),
  activity: one(activities, { fields: [workoutActivityLinks.activityId], references: [activities.id] }),
}))
