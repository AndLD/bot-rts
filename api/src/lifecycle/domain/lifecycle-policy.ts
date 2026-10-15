export const LIFECYCLE_POLICY = Symbol('LifecyclePolicy')

const DAY_MS = 24 * 60 * 60 * 1000

// How long data is kept and how often the cleanup runs (docs: data lifecycle); tunable configuration
export interface LifecyclePolicy {
  // Whether the scheduler runs on this node; the integration tests call the service directly
  isEnabled: boolean
  intervalMs: number
  // An account whose email was never confirmed, and that has no base, is deleted after this many days
  unverifiedDays: number
  // A player who has not been active for this many days is told, and the account is erased after `noticeDays` more.
  // 0 switches the erasure off. Players with running scripts, paid plans or a privileged role are never erased for inactivity.
  inactiveDays: number
  noticeDays: number
  // Finished and killed script executions are kept this long
  executionDays: number
  // Expired logins and links are kept this long, for the security trail
  authDays: number
  // Rows of `player_activity` (the days a player was active, for the analytics) are kept this long
  activityDays: number
}

export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicy = {
  isEnabled: true,
  intervalMs: 60 * 60 * 1000,
  unverifiedDays: 7,
  inactiveDays: 365,
  noticeDays: 30,
  executionDays: 30,
  authDays: 7,
  activityDays: 400
}

export const days = (count: number): number => count * DAY_MS
