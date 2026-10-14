export const LOGIN_OUTCOMES = ['success', 'bad_credentials', 'banned', 'unverified', 'error'] as const

export type LoginOutcome = (typeof LOGIN_OUTCOMES)[number]

// One sign-in attempt of the custom provider, kept for the security page of the admin console (design §25.3)
export interface LoginAttempt {
  readonly id: string
  readonly at: Date
  // What was typed, in lower case
  readonly email: string
  // Known for a successful attempt only
  readonly userId: string | null
  readonly ip: string | null
  readonly userAgent: string | null
  readonly outcome: LoginOutcome
}
