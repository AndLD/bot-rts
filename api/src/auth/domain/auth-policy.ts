export const AUTH_POLICY = Symbol('AuthPolicy')

// Tunable lifetimes (AGENTS.md §9: balance and policy numbers live in configuration), in milliseconds
export interface AuthPolicy {
  // How long a login (refresh token) lasts without being used
  sessionTtlMs: number
  emailVerificationTtlMs: number
  passwordResetTtlMs: number
  emailChangeTtlMs: number
  accountDeletionTtlMs: number
}

const HOUR = 60 * 60 * 1000

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  sessionTtlMs: 30 * 24 * HOUR,
  emailVerificationTtlMs: 24 * HOUR,
  passwordResetTtlMs: HOUR,
  emailChangeTtlMs: 24 * HOUR,
  accountDeletionTtlMs: HOUR
}
