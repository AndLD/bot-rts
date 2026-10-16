import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { eraseAccount } from '../../auth/application/account-erasure'
import { NotificationService } from '../../player-notifications/application/notification.service'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { Logger } from '../../shared/application/logger'
import { RetentionSettings } from '../../../../lib/utils/admin-retention'
import { RetentionPolicy } from '../../retention/application/retention-settings.service'
import { days } from '../domain/lifecycle-policy'
import { InactivityNotifier } from './inactivity-notifier'
import { JobStatusStore } from '../../operations/application/ports'
import { EMPTY_REPORT, LifecycleReport, LifecycleStatus } from './lifecycle-status'
import { LifecycleRepository } from './lifecycle.repository'

// One pass is bounded, so that a first run on a large database does not hold a long transaction or flood the mail server
const BATCH = 200

const ORDINARY_KINDS = [TERMINAL_LOG_KIND.INPUT, TERMINAL_LOG_KIND.OUTPUT, TERMINAL_LOG_KIND.ERROR]

// The name under which the console finds the report of this job
export const LIFECYCLE_JOB = 'lifecycle'

export interface LifecycleDependencies {
  repository: LifecycleRepository
  unitOfWork: UnitOfWork
  notifier: InactivityNotifier
  notifications: Pick<NotificationService, 'purge'>
  // The values in force (the environment's, overridden from the console), read again at the start of every pass
  settings: RetentionPolicy
  clock: Clock
  status: LifecycleStatus
  // Where the result of a pass is kept for the admin console, which may run on another node
  jobs: JobStatusStore
  logger: Logger
}

// The scheduled cleanup (Phase 8.4): retention of terminal logs, executions, notifications and expired logins, and the
// lifecycle of accounts that were never confirmed or that their players left. Each step is independent, so one failing
// step does not stop the others.
export class LifecycleService {
  constructor(private readonly deps: LifecycleDependencies) {}

  // How long to wait after a pass: the interval in force at the start of the last pass
  private nextIntervalMs: number | null = null

  intervalMs(fallbackMs: number): number {
    return this.nextIntervalMs ?? fallbackMs
  }

  async runOnce(): Promise<LifecycleReport> {
    const report = { ...EMPTY_REPORT }
    const settings = await this.deps.settings.current()
    this.nextIntervalMs = Math.round((settings.lifecycle.intervalMinutes as number) * 60_000)

    if (!settings.lifecycle.isEnabled) {
      return report
    }
    // A step that is switched off is skipped; the others do not depend on it
    const steps: Array<[string, RetentionSettings[keyof RetentionSettings], () => Promise<void>]> = [
      ['terminal logs', settings.terminalLogs, async () => this.expireTerminalLogs(report, settings)],
      ['executions', settings.executions, async () => this.expireExecutions(report, settings)],
      [
        'notifications',
        settings.notifications,
        async () =>
          void (report.notificationsDeleted = await this.deps.notifications.purge(
            settings.notifications.days as number
          ))
      ],
      ['logins and links', settings.authData, async () => this.expireAuthData(report, settings)],
      ['unverified accounts', settings.unverifiedAccounts, async () => this.deleteUnverified(report, settings)],
      ['inactive accounts', settings.inactiveAccounts, async () => this.handleInactive(report, settings)],
      ['player activity', settings.playerActivity, async () => this.expireActivity(report, settings)],
      // The history has no switch of its own: it is cleaned whenever the job runs
      ['monitoring history', { isEnabled: true }, async () => this.expireMonitoringHistory(report, settings)]
    ]
    let failedSteps = 0

    for (const [name, values, step] of steps) {
      if (!values.isEnabled) {
        continue
      }
      try {
        await step()
      } catch (error) {
        failedSteps += 1
        this.deps.status.recordFailure()
        this.deps.logger.error(`Data lifecycle step "${name}" failed: ${(error as Error).message}`)
      }
    }

    this.deps.status.recordRun(report, this.now())
    await this.reportStatus({ ...report, failedSteps })
    this.deps.logger.info(`Data lifecycle pass: ${JSON.stringify(report)}`)
    return report
  }

  private async reportStatus(lastPass: Record<string, number>): Promise<void> {
    const { lastRunAt, failures, totals } = this.deps.status.snapshot()

    try {
      await this.deps.jobs.record({
        name: LIFECYCLE_JOB,
        lastRunAt: (lastRunAt as Date).getTime(),
        failures,
        totals: { ...totals },
        lastPass
      })
    } catch (error) {
      this.deps.logger.error(`The status of the data lifecycle job could not be stored: ${(error as Error).message}`)
    }
  }

  private now(): Date {
    return this.deps.clock.now()
  }

  private ago(ms: number): Date {
    return new Date(this.now().getTime() - ms)
  }

  private async expireTerminalLogs(report: LifecycleReport, { terminalLogs }: RetentionSettings) {
    const { repository } = this.deps
    const logAge = this.ago(days(terminalLogs.logDays as number))
    const ordinary = await repository.deleteTerminalLogsOlderThan(ORDINARY_KINDS, logAge)
    const security = await repository.deleteTerminalLogsOlderThan(
      [TERMINAL_LOG_KIND.SECURITY],
      this.ago(days(terminalLogs.securityDays as number))
    )
    report.terminalLogsDeleted = ordinary + security
    report.terminalSessionsDeleted = await repository.deleteEndedTerminalSessionsWithoutLogs(logAge)
  }

  private async expireMonitoringHistory(report: LifecycleReport, { monitoring }: RetentionSettings) {
    report.monitoringHistoryDeleted = await this.deps.repository.deleteMetricHistoryBefore(
      this.ago(days(monitoring.coarseDays as number))
    )
  }

  private async expireExecutions(report: LifecycleReport, { executions }: RetentionSettings) {
    report.executionsDeleted = await this.deps.repository.deleteEndedExecutionsBefore(
      this.ago(days(executions.days as number))
    )
  }

  private async expireAuthData(report: LifecycleReport, { authData }: RetentionSettings) {
    report.authRowsDeleted = await this.deps.repository.deleteExpiredAuthData(this.ago(days(authData.days as number)))
  }

  private async expireActivity(report: LifecycleReport, { playerActivity }: RetentionSettings) {
    report.playerActivityDeleted = await this.deps.repository.deletePlayerActivityBefore(
      this.ago(days(playerActivity.days as number))
    )
  }

  private async deleteUnverified(report: LifecycleReport, { unverifiedAccounts }: RetentionSettings) {
    const { repository } = this.deps
    const ids = await repository.findStaleUnverifiedUserIds(this.ago(days(unverifiedAccounts.days as number)), BATCH)
    report.unverifiedAccountsDeleted = ids.length ? await repository.deleteUsers(ids) : 0
  }

  // First a notice, then, after `noticeDays` without the player coming back, the erasure
  private async handleInactive(report: LifecycleReport, { inactiveAccounts }: RetentionSettings) {
    const { repository, unitOfWork, notifier } = this.deps

    await repository.clearNoticesOfReturnedPlayers()
    const now = this.now()
    const noticeMs = days(inactiveAccounts.noticeDays as number)
    // Players are told early enough that the erasure comes `noticeDays` after the notice
    const candidates = await repository.findInactiveAccounts(
      this.ago(days(inactiveAccounts.inactiveDays as number) - noticeMs),
      BATCH
    )

    for (const account of candidates) {
      if (!account.noticeSentAt) {
        await notifier.sendNotice(account.email, account.name, new Date(now.getTime() + noticeMs))
        await repository.markInactivityNotice(account.userId, now)
        report.inactivityNoticesSent += 1
      } else if (now.getTime() - account.noticeSentAt.getTime() >= noticeMs) {
        const erased = await unitOfWork.run(async (repositories) => {
          const user = await repositories.users.findById(account.userId)
          if (!user || user.deletedAt) {
            return false
          }
          await eraseAccount(repositories, user, now)
          return true
        })
        report.inactiveAccountsErased += erased ? 1 : 0
      }
    }
  }
}
