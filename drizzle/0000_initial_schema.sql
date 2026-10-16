CREATE TYPE "public"."ability" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."activity_source" AS ENUM('STRAVA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."compliance" AS ENUM('NAILED', 'CLOSE', 'OFF');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('ACTIVE', 'REVOKED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('FIVE_K', 'TEN_K', 'HALF', 'MARATHON', 'BUILD_MILEAGE');--> statement-breakpoint
CREATE TYPE "public"."linked_by" AS ENUM('AUTO', 'USER');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('PR', 'STRAVA_REVOKED', 'PLAN_REALIGNMENT', 'WORKOUT_AUTOLINKED', 'WEEKLY_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."pace_basis_kind" AS ENUM('RACE_RESULT', 'ESTIMATED_5K', 'EASY_PACE');--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('BASE', 'BUILD', 'PEAK', 'TAPER', 'RACE');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."progression" AS ENUM('GRADUAL', 'STEADY', 'AGGRESSIVE');--> statement-breakpoint
CREATE TYPE "public"."units" AS ENUM('KM', 'MI');--> statement-breakpoint
CREATE TYPE "public"."version_reason" AS ENUM('INITIAL', 'SETTINGS_CHANGED', 'RACE_MOVED', 'REALIGNMENT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('SCHEDULED', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."workout_type" AS ENUM('RECOVERY', 'EASY', 'LONG', 'TEMPO', 'THRESHOLD', 'INTERVALS', 'RACE_PACE', 'RACE', 'REST');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "activity_source" NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"sport_type" text DEFAULT 'Run' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"started_at_local" timestamp NOT NULL,
	"distance_m" integer NOT NULL,
	"moving_time_s" integer NOT NULL,
	"elapsed_time_s" integer NOT NULL,
	"avg_pace_s_per_km" integer NOT NULL,
	"avg_hr" smallint,
	"max_hr" smallint,
	"elevation_gain_m" integer,
	"map_polyline" text,
	"laps" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ability" "ability" DEFAULT 'INTERMEDIATE' NOT NULL,
	"pace_basis_kind" "pace_basis_kind",
	"pace_basis_distance_m" integer,
	"pace_basis_time_s" integer,
	"estimated_5k_s" integer,
	"weekly_km" numeric(5, 1) DEFAULT '0' NOT NULL,
	"longest_run_km" numeric(5, 1) DEFAULT '0' NOT NULL,
	"date_of_birth" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dismissed_matches" (
	"activity_id" uuid NOT NULL,
	"workout_id" uuid NOT NULL,
	"dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissed_matches_activity_id_workout_id_pk" PRIMARY KEY("activity_id","workout_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link_url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"user_id" uuid NOT NULL,
	"distance_key" text NOT NULL,
	"time_s" integer NOT NULL,
	"activity_id" uuid,
	"achieved_at" timestamp with time zone NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	CONSTRAINT "personal_records_user_id_distance_key_pk" PRIMARY KEY("user_id","distance_key")
);
--> statement-breakpoint
CREATE TABLE "plan_settings" (
	"plan_id" uuid PRIMARY KEY NOT NULL,
	"days_per_week" smallint NOT NULL,
	"preferred_days" smallint[] NOT NULL,
	"long_run_day" smallint NOT NULL,
	"progression" "progression" DEFAULT 'STEADY' NOT NULL,
	"target_weekly_km" numeric(5, 1),
	"max_easy_km" numeric(5, 1),
	"max_long_km" numeric(5, 1),
	"max_hard_km" numeric(5, 1),
	"include_strength" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"reason" "version_reason" DEFAULT 'INITIAL' NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"total_distance_m" integer DEFAULT 0 NOT NULL,
	"peak_weekly_m" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_versions_plan_no" UNIQUE("plan_id","version_no")
);
--> statement-breakpoint
CREATE TABLE "plan_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"week_no" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"phase" "phase" NOT NULL,
	"target_distance_m" integer NOT NULL,
	"is_cutback" boolean DEFAULT false NOT NULL,
	"is_taper" boolean DEFAULT false NOT NULL,
	CONSTRAINT "plan_weeks_version_no" UNIQUE("plan_version_id","week_no")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" "goal" NOT NULL,
	"race_name" text,
	"race_date" date,
	"start_date" date NOT NULL,
	"total_weeks" integer NOT NULL,
	"status" "plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"athlete_id" bigint NOT NULL,
	"athlete_name" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text[] NOT NULL,
	"status" "connection_status" DEFAULT 'ACTIVE' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"auto_link" boolean DEFAULT true NOT NULL,
	"same_day_only" boolean DEFAULT false NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"avatar_url" text,
	"units" "units" DEFAULT 'KM' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"week_starts_on" smallint DEFAULT 0 NOT NULL,
	"email_verified" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'strava' NOT NULL,
	"object_type" text NOT NULL,
	"object_id" bigint NOT NULL,
	"aspect_type" text NOT NULL,
	"owner_id" bigint,
	"event_time" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_idempotency" UNIQUE("provider","object_id","aspect_type","event_time")
);
--> statement-breakpoint
CREATE TABLE "weekly_rollups" (
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"actual_distance_m" integer DEFAULT 0 NOT NULL,
	"actual_moving_time_s" integer DEFAULT 0 NOT NULL,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"planned_distance_m" integer DEFAULT 0 NOT NULL,
	"planned_workouts" integer DEFAULT 0 NOT NULL,
	"completed_workouts" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_rollups_user_id_week_start_pk" PRIMARY KEY("user_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "workout_activity_links" (
	"workout_id" uuid PRIMARY KEY NOT NULL,
	"activity_id" uuid NOT NULL,
	"linked_by" "linked_by" NOT NULL,
	"match_score" numeric(3, 2),
	"compliance" "compliance",
	"rep_analysis" jsonb,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_activity_links_activity_id_unique" UNIQUE("activity_id")
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_week_id" uuid NOT NULL,
	"workout_key" text NOT NULL,
	"date" date NOT NULL,
	"order_in_day" smallint DEFAULT 0 NOT NULL,
	"type" "workout_type" NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"planned_distance_m" integer NOT NULL,
	"est_duration_min_s" integer NOT NULL,
	"est_duration_max_s" integer NOT NULL,
	"steps" jsonb NOT NULL,
	"status" "workout_status" DEFAULT 'SCHEDULED' NOT NULL,
	"moved_from_date" date,
	"is_extra" boolean DEFAULT false NOT NULL,
	"notes" text,
	"rpe" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_matches" ADD CONSTRAINT "dismissed_matches_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dismissed_matches" ADD CONSTRAINT "dismissed_matches_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_settings" ADD CONSTRAINT "plan_settings_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_weeks" ADD CONSTRAINT "plan_weeks_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_rollups" ADD CONSTRAINT "weekly_rollups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_activity_links" ADD CONSTRAINT "workout_activity_links_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_activity_links" ADD CONSTRAINT "workout_activity_links_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_week_id_plan_weeks_id_fk" FOREIGN KEY ("plan_week_id") REFERENCES "public"."plan_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_user_external" ON "activities" USING btree ("user_id","external_id") WHERE "activities"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "activities_user_started_idx" ON "activities" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plan_weeks_version_idx" ON "plan_weeks" USING btree ("plan_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_active_per_user" ON "plans" USING btree ("user_id") WHERE "plans"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "plans_user_idx" ON "plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "workouts_week_date_idx" ON "workouts" USING btree ("plan_week_id","date");--> statement-breakpoint
CREATE INDEX "workouts_date_idx" ON "workouts" USING btree ("date");