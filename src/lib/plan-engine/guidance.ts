/**
 * What each session is for, and how to run it.
 *
 * Lives in the engine because it is keyed by the engine's own template and
 * zone identifiers — if a template is added, the missing entry is a type
 * error rather than a silently blank panel.
 */

import type { PaceZone, WorkoutType } from './types'

export type Guidance = {
  /** One line: what this is. */
  what: string
  /** One line: how to run it. */
  how: string
  /** Why it is in the plan at all. */
  why: string
}

export const TYPE_GUIDANCE: Record<WorkoutType, Guidance> = {
  RECOVERY: {
    what: 'The easiest run in the plan, and deliberately short.',
    how: 'Slower than feels natural. If you are wondering whether it is too slow, it is about right.',
    why: 'Moves blood through tired legs without adding any training stress of its own.',
  },
  EASY: {
    what: 'The backbone of the plan — most of your weekly distance lives here.',
    how: 'Conversational. You should be able to speak in full sentences the whole way.',
    why: 'Builds the aerobic base that everything faster is built on. Running these too hard is the most common mistake in amateur training.',
  },
  LONG: {
    what: 'The week’s longest run, usually at the weekend.',
    how: 'Start slower than you think you need to. Finishing strong matters more than average pace.',
    why: 'Teaches your body to keep going as fuel runs low, which is what decides the back half of a race.',
  },
  TEMPO: {
    what: 'A sustained block at a strong but controlled effort.',
    how: 'Comfortably hard. You could say a short sentence, not hold a conversation.',
    why: 'Lifts the pace you can hold before fatigue starts to build.',
  },
  THRESHOLD: {
    what: 'Longer reps at the edge of what you can sustain.',
    how: 'Hard but even. Each rep should finish at the same pace as it started.',
    why: 'Pushes up the ceiling where your body can still clear lactate as fast as it makes it.',
  },
  INTERVALS: {
    what: 'Short, fast reps with recovery between them.',
    how: 'Fast but repeatable — the last rep should match the first. Take the full recovery.',
    why: 'Develops top-end speed and running economy, so race pace feels easier.',
  },
  RACE_PACE: {
    what: 'A long run with a block at the pace you intend to race.',
    how: 'Settle into race pace and hold it. Practise your fuelling here too.',
    why: 'Rehearses race effort on tired legs, which is exactly when you will need it.',
  },
  RACE: {
    what: 'The day the plan was built for.',
    how: 'Warm up, start conservatively, and trust the training.',
    why: 'This is the goal.',
  },
  REST: {
    what: 'No running.',
    how: 'Walk, stretch, sleep.',
    why: 'Adaptation happens during rest, not during the run. Skipping rest days costs more than skipping easy runs.',
  },
}

/** Plain-language name and meaning for each pace zone. */
export const ZONE_GUIDANCE: Record<PaceZone, { label: string; feel: string }> = {
  RECOVERY: { label: 'Recovery', feel: 'Very easy, almost strolling' },
  EASY: { label: 'Easy', feel: 'Conversational' },
  LONG: { label: 'Long run', feel: 'Steady and relaxed' },
  MARATHON: { label: 'Marathon pace', feel: 'Comfortably strong' },
  THRESHOLD: { label: 'Threshold', feel: 'Comfortably hard' },
  TEN_K: { label: '10K pace', feel: 'Hard, controlled' },
  FIVE_K: { label: '5K pace', feel: 'Very hard' },
  INTERVAL: { label: 'Interval', feel: 'Near flat out' },
}

/** Extra notes for the handful of templates with a specific shape. */
export const TEMPLATE_NOTES: Record<string, string> = {
  tempo_2_1_1:
    'Two kilometres at threshold, an easy kilometre to clear your legs, then one more kilometre at threshold. The easy block is part of the session, not a break from it.',
  pyramid_intervals:
    'Reps climb to the longest and come back down. The ones after the peak are the ones that count — hold the pace when you are tired.',
  progressive_mile_repeats:
    'Each mile a little quicker than the last. Start slower than you want to so the final rep is the fastest.',
  threshold_2km_repeats:
    'Long reps at threshold with short jogs between. Even pacing across the reps beats a fast first one.',
  progressive_run: 'Three equal blocks, each quicker. Finish the last one feeling strong, not wrecked.',
  fartlek: 'Unstructured speed play. Lift the pace for the fast parts, float the recoveries.',
  strides:
    'Short accelerations at the end of an easy run. Relaxed and fast, not a sprint — they sharpen your form without adding fatigue.',
  race_pace_long: 'Practise race pace inside a long run, and use it to rehearse your fuelling.',
}
