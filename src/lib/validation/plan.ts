/**
 * Zod schemas at the API boundary. Shared with the client so the wizard can
 * validate as you type using exactly the rules the server will enforce.
 */

import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const weekday = z.number().int().min(0).max(6)

export const paceBasisSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('RACE_RESULT'),
    distanceM: z.number().int().positive().max(100_000),
    timeS: z.number().int().positive().max(86_400),
  }),
  z.object({ kind: z.literal('ESTIMATED_5K'), timeS: z.number().int().positive().max(7_200) }),
  z.object({ kind: z.literal('EASY_PACE'), secPerKm: z.number().int().min(120).max(1_200) }),
])

export const planRequestSchema = z
  .object({
    goal: z.enum(['FIVE_K', 'TEN_K', 'HALF', 'MARATHON', 'BUILD_MILEAGE']),
    raceDate: isoDate.optional(),
    planWeeks: z.number().int().min(4).max(52).optional(),
    startDate: isoDate,
    raceName: z.string().trim().max(80).optional(),

    daysPerWeek: z.number().int().min(2).max(7),
    preferredDays: z.array(weekday).min(2).max(7),
    longRunDay: weekday,

    ability: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    currentWeeklyKm: z.number().min(0).max(250),
    currentLongestKm: z.number().min(0).max(100),

    targetWeeklyKm: z.number().min(0).max(250).optional(),
    progression: z.enum(['GRADUAL', 'STEADY', 'AGGRESSIVE']),
    maxEasyKm: z.number().min(1).max(60).optional(),
    maxLongKm: z.number().min(1).max(60).optional(),
    maxHardKm: z.number().min(1).max(60).optional(),

    paceBasis: paceBasisSchema.optional(),
    units: z.enum(['KM', 'MI']).default('KM'),
  })
  // Structural rules live here; training rules live in the engine's validate(),
  // which returns overridable warnings rather than hard failures.
  .refine((v) => v.goal === 'BUILD_MILEAGE' || !!v.raceDate, {
    message: 'Pick your race date.',
    path: ['raceDate'],
  })
  .refine((v) => v.goal !== 'BUILD_MILEAGE' || !!v.planWeeks, {
    message: 'Choose how many weeks to train for.',
    path: ['planWeeks'],
  })
  .refine((v) => new Set(v.preferredDays).size === v.preferredDays.length, {
    message: 'Duplicate days.',
    path: ['preferredDays'],
  })

export type PlanRequestInput = z.input<typeof planRequestSchema>

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
})

export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, 'Tell us your name.').max(60),
  timezone: z.string().max(64).default('UTC'),
})
