import {
  ERASURE_CONFIRMATION,
  isRetentionJob,
  RETENTION_JOBS,
  RETENTION_RANGES,
  RetentionJob,
  retentionProblems,
  RetentionSettings,
  RetentionValues
} from '../../../../lib/utils/admin-retention'
import { Clock } from '../../shared/application/clock'
import { Logger } from '../../shared/application/logger'
import { ValidationError } from '../../shared/domain/errors'

export const RETENTION_STORE = Symbol('RetentionStore')
export const RETENTION_POLICY = Symbol('RetentionPolicy')

export const LOG_RETENTION = Symbol('LogRetention')

// Puts the retention of the logs and traces into force where they are kept (the lifecycle policy of the log store)
export interface LogRetention {
  apply(days: number): Promise<void>
}

// For a deployment without a log store to change: the setting is kept and nothing more is done
export const NO_LOG_RETENTION: LogRetention = { apply: () => Promise.resolve() }

export type RetentionOverrides = Partial<Record<RetentionJob, RetentionValues>>

export interface StoredRetention {
  overrides: RetentionOverrides
  updatedAt: Date | null
}

// Where the overrides of the retention settings are kept: one document of the game settings, shared by every node
export interface RetentionStore {
  load(): Promise<StoredRetention>
  // Null removes every override
  save(overrides: RetentionOverrides | null, at: Date): Promise<void>
}

// What the jobs and the writers of retained data ask: the values in force
export interface RetentionPolicy {
  // Reads the store: a job calls it at the start of every pass
  current(): Promise<RetentionSettings>
  // The last values read, without waiting; refreshed in the background when older than the cache time. For code that cannot await.
  snapshot(): RetentionSettings
}

// Defaults (the environment) overlaid with what an admin set in the console
export function mergeRetention(defaults: RetentionSettings, overrides: RetentionOverrides): RetentionSettings {
  return Object.fromEntries(
    RETENTION_JOBS.map((job) => [job, { ...defaults[job], ...pick(job, overrides[job]) }])
  ) as RetentionSettings
}

// Only the fields that the job has, so that a stored field that no longer exists never reaches a job
function pick(job: RetentionJob, values: RetentionValues | undefined): RetentionValues {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([field]) => field === 'isEnabled' || field in RETENTION_RANGES[job])
  )
}

export type RetentionPatch = Partial<Record<string, Record<string, unknown>>>

// The retention settings of the game (design §25.3): the environment gives the defaults, the console overrides them, and every
// pass of a job reads the result again, so no restart is needed. Every value is held to its floor and ceiling.
export class RetentionSettingsService implements RetentionPolicy {
  private latest: RetentionSettings
  private readAt = 0
  private isRefreshing = false

  constructor(
    private readonly store: RetentionStore,
    private readonly defaults: RetentionSettings,
    private readonly clock: Clock,
    private readonly cacheMs: number,
    private readonly logger: Logger,
    private readonly logRetention: LogRetention = NO_LOG_RETENTION
  ) {
    this.latest = defaults
  }

  getDefaults(): RetentionSettings {
    return this.defaults
  }

  async current(): Promise<RetentionSettings> {
    return (await this.load()).settings
  }

  async load(): Promise<{ settings: RetentionSettings; updatedAt: Date | null }> {
    const { overrides, updatedAt } = await this.store.load()
    this.latest = mergeRetention(this.defaults, overrides)
    this.readAt = this.clock.now().getTime()

    return { settings: this.latest, updatedAt }
  }

  snapshot(): RetentionSettings {
    if (!this.isRefreshing && this.clock.now().getTime() - this.readAt >= this.cacheMs) {
      this.isRefreshing = true
      this.load()
        .catch((error) => this.logger.error(`The retention settings could not be read: ${(error as Error).message}`))
        .finally(() => {
          this.isRefreshing = false
        })
    }

    return this.latest
  }

  // Changes only the fields the patch names. Switching on the erasure of inactive accounts needs the typed word.
  async update(
    patch: RetentionPatch,
    confirmation: string | undefined
  ): Promise<{ before: RetentionSettings; after: RetentionSettings }> {
    const problems: string[] = []
    const entries = Object.entries(patch)

    if (!entries.length) {
      throw new ValidationError('Name at least one setting')
    }
    for (const [job, values] of entries) {
      if (!isRetentionJob(job) || typeof values !== 'object' || values === null || !Object.keys(values).length) {
        problems.push(`${job} is not a retention job`)
      } else {
        problems.push(...retentionProblems(job, values))
      }
    }
    if (problems.length) {
      throw new ValidationError(problems.join('; '))
    }

    const { overrides } = await this.store.load()
    const before = mergeRetention(this.defaults, overrides)
    const next: RetentionOverrides = { ...overrides }

    for (const [job, values] of entries as Array<[RetentionJob, RetentionValues]>) {
      next[job] = { ...next[job], ...values }
    }
    const after = mergeRetention(this.defaults, next)

    if (
      after.inactiveAccounts.isEnabled &&
      !before.inactiveAccounts.isEnabled &&
      confirmation !== ERASURE_CONFIRMATION
    ) {
      throw new ValidationError(`Type ${ERASURE_CONFIRMATION} to switch on the erasure of inactive accounts`)
    }
    await this.applyLogs(before, after)
    await this.store.save(next, this.clock.now())
    this.latest = after
    this.readAt = this.clock.now().getTime()

    return { before, after }
  }

  // The retention of the logs is kept by the log store, so a change goes there first: if it cannot be applied, nothing is saved
  private async applyLogs(before: RetentionSettings, after: RetentionSettings): Promise<void> {
    if (before.logs.days !== after.logs.days) {
      await this.logRetention.apply(after.logs.days as number)
    }
  }

  // Removes every override: the environment's values are in force again
  async reset(): Promise<{ before: RetentionSettings; after: RetentionSettings }> {
    const before = (await this.load()).settings

    await this.applyLogs(before, this.defaults)
    await this.store.save(null, this.clock.now())
    this.latest = this.defaults
    this.readAt = this.clock.now().getTime()

    return { before, after: this.defaults }
  }
}
