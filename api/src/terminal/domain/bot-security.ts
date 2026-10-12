// How a bot defends itself against password guessing (design §11.2.2); tunable configuration
export interface BotSecurityPolicy {
  // Energy a connection attempt costs the bot it is made from, right or wrong
  attemptEnergy: number
  // How long an attempt takes before the answer comes back, in ms
  attemptDelayMs: number
  // Failed attempts in a row after which the bot refuses foreign connections
  maxFailures: number
  // For how long, in ms
  lockoutMs: number
}

export const DEFAULT_BOT_SECURITY: BotSecurityPolicy = {
  attemptEnergy: 5,
  attemptDelayMs: 1000,
  maxFailures: 5,
  lockoutMs: 10 * 60 * 1000
}

// What a bot remembers of the attempts to connect to it
export interface AccessState {
  // Failed attempts in a row; a lockout or a right password starts the count again
  readonly failures: number
  readonly lockedUntil: Date | null
}

export const NO_ATTEMPTS: AccessState = { failures: 0, lockedUntil: null }

export function isLockedOut(state: AccessState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
}

// The state after a wrong password: the last allowed failure locks the bot out
export function afterFailure(state: AccessState, now: Date, policy: BotSecurityPolicy): AccessState {
  const failures = state.failures + 1
  return failures >= policy.maxFailures
    ? { failures: 0, lockedUntil: new Date(now.getTime() + policy.lockoutMs) }
    : { failures, lockedUntil: null }
}
