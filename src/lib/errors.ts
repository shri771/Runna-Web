/**
 * One error shape for the whole API. See docs/07-api-contract.md.
 *
 * `code` is a stable machine string the client switches on, `message` is
 * user-presentable, and `details` carries whatever the UI needs to offer a
 * recovery action (e.g. which workout an activity is already linked to).
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'PLAN_ALREADY_ACTIVE'
  | 'PLAN_GENERATION_FAILED'
  | 'WORKOUT_ALREADY_LINKED'
  | 'ACTIVITY_ALREADY_LINKED'
  | 'INVALID_MOVE'
  | 'STRAVA_NOT_CONNECTED'
  | 'STRAVA_REVOKED'
  | 'STRAVA_RATE_LIMITED'
  | 'OAUTH_STATE_MISMATCH'
  | 'SCOPE_INSUFFICIENT'
  | 'RATE_LIMITED'
  | 'INTERNAL'

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  PLAN_ALREADY_ACTIVE: 409,
  PLAN_GENERATION_FAILED: 422,
  WORKOUT_ALREADY_LINKED: 409,
  ACTIVITY_ALREADY_LINKED: 409,
  INVALID_MOVE: 422,
  STRAVA_NOT_CONNECTED: 409,
  STRAVA_REVOKED: 409,
  STRAVA_RATE_LIMITED: 503,
  OAUTH_STATE_MISMATCH: 400,
  SCOPE_INSUFFICIENT: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }

  get status(): number {
    return STATUS[this.code]
  }

  toResponse(): Response {
    return Response.json(
      { error: { code: this.code, message: this.message, field: this.field ?? null, details: this.details } },
      { status: this.status },
    )
  }
}

/**
 * Wrap a route handler so thrown AppErrors become their envelope and anything
 * unexpected becomes a 500 without leaking internals to the client.
 */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof AppError) return error.toResponse()
      console.error('[unhandled]', error)
      return new AppError('INTERNAL', 'Something went wrong on our end.').toResponse()
    }
  }
}
