import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { eraseAccount } from '../../auth/application/account-erasure'
import { NotificationService } from '../../player-notifications/application/notification.service'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { Logger } from '../../shared/application/logger'
import { TerminalRetention } from '../../terminal/domain/terminal-retention'
import { days, LifecyclePolicy } from '../domain/lifecycle-policy'
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
  policy: LifecyclePolicy
  retention: TerminalRetention
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

  async runOnce(): Promise<LifecycleReport> {
    const report = { ...EMPTY_REPORT }
    const steps: Array<[string, () => Promise<void>]> = [
      ['terminal logs', async () => this.expireTerminalLogs(report)],
      ['executions', async () => this.expireExecutions(report)],
      ['notifications', async () => void (report.notificationsDeleted = await this.deps.notifications.purge())],
      ['logins and links', async () => this.expireAuthData(report)],
      ['unverified accounts', async () => this.deleteUnverified(report)],
      ['inactive accounts', async () => this.handleInactive(report)]
    ]

    for (const [name, step] of steps) {
      try {
        await step()
      } catch (error) {
        this.deps.status.recordFailure()
        this.deps.logger.error(`Data lifecycle step "${name}" failed: ${(error as Error).message}`)
      }
    }

    this.deps.status.recordRun(report, this.now())
    await this.reportStatus()
    this.deps.logger.info(`Data lifecycle pass: ${JSON.stringify(report)}`)
    return report
  }

  private async reportStatus(): Promise<void> {
    const { lastRunAt, failures, totals } = this.deps.status.snapshot()

    try {
      await this.deps.jobs.record({
        name: LIFECYCLE_JOB,
        lastRunAt: (lastRunAt as Date).getTime(),
        failures,
        totals: { ...totals }
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

  private async expireTerminalLogs(report: LifecycleReport) {
    const { repository, retention } = this.deps
    const ordinary = await repository.deleteTerminalLogsOlderThan(ORDINARY_KINDS, this.ago(days(retention.logDays)))
    const security = await repository.deleteTerminalLogsOlderThan(
      [TERMINAL_LOG_KIND.SECURITY],
      this.ago(days(retention.securityDays))
    )
    report.terminalLogsDeleted = ordinary + security
    report.terminalSessionsDeleted = await repository.deleteEndedTerminalSessionsWithoutLogs(
      this.ago(days(retention.logDays))
    )
  }

  private async expireExecutions(report: LifecycleReport) {
    report.executionsDeleted = await this.deps.repository.deleteEndedExecutionsBefore(
      this.ago(days(this.deps.policy.executionDays))
    )
  }

  private async expireAuthData(report: LifecycleReport) {
    report.authRowsDeleted = await this.deps.repository.deleteExpiredAuthData(this.ago(days(this.deps.policy.authDays)))
  }

  private async deleteUnverified(report: LifecycleReport) {
    const { repository, policy } = this.deps
    const ids = await repository.findStaleUnverifiedUserIds(this.ago(days(policy.unverifiedDays)), BATCH)
    report.unverifiedAccountsDeleted = ids.length ? await repository.deleteUsers(ids) : 0
  }

  // First a notice, then, after `noticeDays` without the player coming back, the erasure
  private async handleInactive(report: LifecycleReport) {
    const { repository, policy, unitOfWork, notifier } = this.deps
    if (policy.inactiveDays <= 0) {
      return
    }

    await repository.clearNoticesOfReturnedPlayers()
    const now = this.now()
    const noticeMs = days(policy.noticeDays)
    // Players are told early enough that the erasure comes `noticeDays` after the notice
    const candidates = await repository.findInactiveAccounts(this.ago(days(policy.inactiveDays) - noticeMs), BATCH)

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
