/**
 * Demo data.
 *
 * An evaluator should see the product working on their first click, not an
 * empty database. This seeds an account mid-way through a half marathon
 * block: completed weeks with linked activities, a few personal records, and
 * some deliberately unlinked runs so the Link tab has something to reconcile.
 *
 *   npm run db:seed
 */

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './index'
import {
  activities,
  athleteProfiles,
  personalRecords,
  planSettings,
  planVersions,
  planWeeks,
  plans,
  users,
  workoutActivityLinks,
  workouts,
} from './schema'
import { addDays, generatePlan, startOfWeek, type PlanRequest } from '@/lib/plan-engine'

const DEMO_EMAIL = 'demo@runna.local'
const DEMO_PASSWORD = 'runna-demo-2026'

const iso = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  console.log('Seeding demo account…')

  // Start the plan 5 weeks back so "today" lands mid-block with real history.
  const today = iso(new Date())
  const startDate = addDays(startOfWeek(today), -5 * 7)
  const raceDate = addDays(startDate, 12 * 7 - 1)

  const request: PlanRequest = {
    goal: 'HALF',
    raceDate,
    startDate,
    raceName: 'City Half',
    daysPerWeek: 5,
    preferredDays: [0, 2, 3, 5, 6],
    longRunDay: 6,
    ability: 'INTERMEDIATE',
    currentWeeklyKm: 28,
    currentLongestKm: 10,
    targetWeeklyKm: 45,
    progression: 'STEADY',
    paceBasis: { kind: 'RACE_RESULT', distanceM: 10000, timeS: 3000 },
    units: 'KM',
  }

  const plan = generatePlan(request)
  if (plan.issues.some((i) => i.severity === 'error')) {
    throw new Error(`Seed plan failed validation: ${JSON.stringify(plan.issues, null, 2)}`)
  }

  // Idempotent: wipe the demo user and rebuild, so re-running is safe.
  await db.delete(users).where(eq(users.email, DEMO_EMAIL))

  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: 'Demo Runner',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      timezone: 'Asia/Kolkata',
    })
    .returning({ id: users.id })
  if (!user) throw new Error('Could not create the demo user.')

  await db.insert(athleteProfiles).values({
    userId: user.id,
    ability: 'INTERMEDIATE',
    paceBasisKind: 'RACE_RESULT',
    paceBasisDistanceM: 10000,
    paceBasisTimeS: 3000,
    estimated5kS: 1437,
    weeklyKm: '28',
    longestRunKm: '10',
  })

  const [planRow] = await db
    .insert(plans)
    .values({
      userId: user.id,
      goal: 'HALF',
      raceName: 'City Half',
      raceDate,
      startDate: plan.startDate,
      totalWeeks: plan.totalWeeks,
      status: 'ACTIVE',
    })
    .returning({ id: plans.id })
  if (!planRow) throw new Error('Could not create the demo plan.')

  await db.insert(planSettings).values({
    planId: planRow.id,
    daysPerWeek: 5,
    preferredDays: [0, 2, 3, 5, 6],
    longRunDay: 6,
    progression: 'STEADY',
    targetWeeklyKm: '45',
  })

  const [version] = await db
    .insert(planVersions)
    .values({
      planId: planRow.id,
      versionNo: 1,
      reason: 'INITIAL',
      inputsSnapshot: request,
      totalDistanceM: plan.totalDistanceM,
      peakWeeklyM: plan.peakWeeklyM,
    })
    .returning({ id: planVersions.id })
  if (!version) throw new Error('Could not create the demo plan version.')

  const weekRows = await db
    .insert(planWeeks)
    .values(
      plan.weeks.map((w) => ({
        planVersionId: version.id,
        weekNo: w.weekNo,
        startDate: w.startDate,
        endDate: w.endDate,
        phase: w.phase,
        targetDistanceM: w.targetDistanceM,
        isCutback: w.isCutback,
        isTaper: w.isTaper,
      })),
    )
    .returning({ id: planWeeks.id, weekNo: planWeeks.weekNo })

  const weekId = new Map(weekRows.map((w) => [w.weekNo, w.id]))

  const workoutRows = await db
    .insert(workouts)
    .values(
      plan.workouts.map((w) => ({
        planWeekId: weekId.get(w.weekNo)!,
        workoutKey: w.workoutKey,
        date: w.date,
        orderInDay: w.orderInDay,
        type: w.type,
        templateId: w.templateId,
        name: w.name,
        plannedDistanceM: w.plannedDistanceM,
        estDurationMinS: w.estDurationMinS,
        estDurationMaxS: w.estDurationMaxS,
        steps: w.steps,
        isExtra: false,
        // Past sessions are mostly done; a few deliberately are not, so the
        // missed-session and Link states have something real to render.
        status: (w.date < today
          ? hashString(w.workoutKey) % 9 === 0
            ? 'SKIPPED'
            : 'COMPLETED'
          : 'SCHEDULED') as 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
      })),
    )
    .returning({ id: workouts.id, date: workouts.date, status: workouts.status, plannedDistanceM: workouts.plannedDistanceM, name: workouts.name })

  await db.update(plans).set({ currentVersionId: version.id }).where(eq(plans.id, planRow.id))

  // An activity for each completed workout, a little off-target so the
  // compliance grades are not all identical.
  const completed = workoutRows.filter((w) => w.status === 'COMPLETED')
  const activityRows = await db
    .insert(activities)
    .values(
      completed.map((w, i) => {
        const drift = 0.94 + ((hashString(w.name + i) % 13) / 100)
        const distanceM = Math.round(w.plannedDistanceM * drift)
        const paceSPerKm = 300 + (hashString(w.name) % 70)
        const startedAt = new Date(`${w.date}T06:40:00Z`)
        return {
          userId: user.id,
          source: 'STRAVA' as const,
          externalId: `demo-${w.id}`,
          name: morningName(i),
          sportType: 'Run',
          startedAt,
          startedAtLocal: startedAt,
          distanceM,
          movingTimeS: Math.round((distanceM / 1000) * paceSPerKm),
          elapsedTimeS: Math.round((distanceM / 1000) * paceSPerKm) + 40,
          avgPaceSPerKm: paceSPerKm,
          avgHr: 142 + (hashString(w.name) % 24),
          elevationGainM: 20 + (hashString(w.name) % 90),
        }
      }),
    )
    .returning({ id: activities.id, distanceM: activities.distanceM })

  await db.insert(workoutActivityLinks).values(
    completed.map((w, i) => {
      const ratio = activityRows[i]!.distanceM / w.plannedDistanceM
      return {
        workoutId: w.id,
        activityId: activityRows[i]!.id,
        linkedBy: 'AUTO' as const,
        matchScore: '0.91',
        compliance: (ratio > 0.97 && ratio < 1.03 ? 'NAILED' : ratio > 0.9 && ratio < 1.1 ? 'CLOSE' : 'OFF') as
          | 'NAILED'
          | 'CLOSE'
          | 'OFF',
      }
    }),
  )

  // Three unlinked runs in the last few days, so the Link tab opens with work
  // to do rather than an empty state.
  const strays = [
    { name: 'Lunch Run', days: -2, distanceM: 8040, pace: 330 },
    { name: 'Parkrun', days: -5, distanceM: 5000, pace: 267 },
    { name: 'Evening shakeout', days: -1, distanceM: 4030, pace: 356 },
  ]
  await db.insert(activities).values(
    strays.map((s, i) => {
      const startedAt = new Date(`${addDays(today, s.days)}T07:05:00Z`)
      return {
        userId: user.id,
        source: 'STRAVA' as const,
        externalId: `demo-stray-${i}`,
        name: s.name,
        sportType: 'Run',
        startedAt,
        startedAtLocal: startedAt,
        distanceM: s.distanceM,
        movingTimeS: Math.round((s.distanceM / 1000) * s.pace),
        elapsedTimeS: Math.round((s.distanceM / 1000) * s.pace) + 30,
        avgPaceSPerKm: s.pace,
      }
    }),
  )

  await db.insert(personalRecords).values([
    { userId: user.id, distanceKey: '1K', timeS: 225, achievedAt: new Date(addDays(today, -40)), seen: true },
    { userId: user.id, distanceKey: '1MI', timeS: 370, achievedAt: new Date(addDays(today, -40)), seen: true },
    { userId: user.id, distanceKey: '5K', timeS: 1334, achievedAt: new Date(addDays(today, -5)), seen: false },
    { userId: user.id, distanceKey: '10K', timeS: 2880, achievedAt: new Date(addDays(today, -68)), seen: true },
  ])

  console.log(`
Seeded.
  email     ${DEMO_EMAIL}
  password  ${DEMO_PASSWORD}
  plan      ${plan.totalWeeks} weeks, ${plan.workouts.length} workouts, race ${raceDate}
  history   ${completed.length} completed and linked, ${strays.length} unlinked
`)
}

/** Stable pseudo-randomness, so a reseed produces identical demo data. */
function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

const NAMES = ['Morning Run', 'Easy miles', 'Before work', 'Riverside loop', 'Evening Run', 'Track session']
const morningName = (i: number) => NAMES[i % NAMES.length]!

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
