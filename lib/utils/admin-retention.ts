// The retention jobs of the game, tunable from the admin console (design §25.3, Operations). Each job has a switch and ranges; every
// range has a floor and a ceiling, so that one slip cannot erase what the game needs. The audit log is not a retention job and is
// never deleted.

export const RETENTION_JOBS = [
  'lifecycle',
  'terminalLogs',
  'executions',
  'notifications',
  'authData',
  'unverifiedAccounts',
  'inactiveAccounts',
  'playerActivity',
  'monitoring',
  'logs'
] as const

export type RetentionJob = (typeof RETENTION_JOBS)[number]

export type RetentionUnit = 'days' | 'minutes' | 'lines'

export interface RetentionRange {
  min: number
  max: number
  unit: RetentionUnit
}

// The ranges of each job, by field name. `lifecycle` is the job that runs all the others on a schedule; switching it off
// stops every step except the monitoring history, which lives in memory.
export const RETENTION_RANGES: Readonly<Record<RetentionJob, Readonly<Record<string, RetentionRange>>>> = {
  lifecycle: { intervalMinutes: { min: 5, max: 1440, unit: 'minutes' } },
  terminalLogs: {
    logDays: { min: 1, max: 365, unit: 'days' },
    securityDays: { min: 7, max: 730, unit: 'days' },
    maxLinesPerBot: { min: 100, max: 100_000, unit: 'lines' }
  },
  executions: { days: { min: 1, max: 365, unit: 'days' } },
  notifications: { days: { min: 1, max: 365, unit: 'days' } },
  authData: { days: { min: 1, max: 90, unit: 'days' } },
  unverifiedAccounts: { days: { min: 1, max: 90, unit: 'days' } },
  inactiveAccounts: {
    inactiveDays: { min: 90, max: 3650, unit: 'days' },
    noticeDays: { min: 7, max: 365, unit: 'days' }
  },
  playerActivity: { days: { min: 30, max: 3650, unit: 'days' } },
  monitoring: { fineDays: { min: 1, max: 30, unit: 'days' }, coarseDays: { min: 7, max: 365, unit: 'days' } },
  // The logs and traces in the log store (Elasticsearch): applied to its lifecycle policy when it is changed
  logs: { days: { min: 1, max: 365, unit: 'days' } }
}

// The monitoring history lives in memory and has no switch: only its two ranges are tunable. The logs have no switch either: their one
// range is what the lifecycle policy of the log store keeps
export const JOBS_WITHOUT_SWITCH: readonly RetentionJob[] = ['monitoring', 'logs']

export type RetentionValues = Record<string, number | boolean>

export type RetentionSettings = Record<RetentionJob, RetentionValues>

// What the console shows (GET /api/v1/admin/retention): the effective values, the defaults, and what each job did last
export interface IRetentionJob {
  job: RetentionJob
  values: RetentionValues
  defaults: RetentionValues
  // Whether any value differs from its default
  isOverridden: boolean
  // What the job removed in its last pass (null when it has not run, or does not report)
  lastRemoved: number | null
}

export interface IRetention {
  jobs: IRetentionJob[]
  lastRunAt: number | null
  // Whether the last pass had a failing step
  hasFailures: boolean
  updatedAt: number | null
}

// The word an admin types to switch on the erasure of inactive accounts
export const ERASURE_CONFIRMATION = 'ERASE'

export function isRetentionJob(value: unknown): value is RetentionJob {
  return (RETENTION_JOBS as readonly unknown[]).includes(value)
}

// What is wrong with a change of one job, in words for the log and the console; empty when it is fine
export function retentionProblems(job: RetentionJob, patch: Record<string, unknown>): string[] {
  const problems: string[] = []
  const ranges = RETENTION_RANGES[job]

  for (const [field, value] of Object.entries(patch)) {
    if (field === 'isEnabled' && !JOBS_WITHOUT_SWITCH.includes(job)) {
      if (typeof value !== 'boolean') {
        problems.push(`${job}.isEnabled must be true or false`)
      }
    } else if (ranges[field]) {
      const { min, max, unit } = ranges[field]

      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        problems.push(`${job}.${field} must be a whole number of ${unit} from ${min} to ${max}`)
      }
    } else {
      problems.push(`${job}.${field} is not a setting`)
    }
  }

  return problems
}
