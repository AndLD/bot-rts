import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { createWorld } from '../../../tests/fakes/world'
import { buildUser } from '../../../tests/integration/builders'
import { RetentionJob, RetentionValues } from '../../../../lib/utils/admin-retention'
import { fakeRetentionPolicy } from '../../../tests/fakes/retention'
import { InactiveAccount, LifecycleRepository } from './lifecycle.repository'
import { collectLifecycleMetrics, LifecycleStatus } from './lifecycle-status'
import { LifecycleService } from './lifecycle.service'
import { PrometheusText } from '../../metrics/application/prometheus'

const DAY = 24 * 3600 * 1000

class FakeLifecycleRepository implements LifecycleRepository {
  unverified: string[] = []
  inactive: InactiveAccount[] = []
  notices = new Map<string, Date>()
  deletedUsers: string[][] = []
  calls: Array<[string, unknown[]]> = []
  failOn: string | null = null

  private record<T>(name: string, args: unknown[], result: T): Promise<T> {
    this.calls.push([name, args])
    return this.failOn === name ? Promise.reject(new Error(`${name} broke`)) : Promise.resolve(result)
  }

  findStaleUnverifiedUserIds(before: Date, limit: number) {
    return this.record('unverified', [before, limit], this.unverified)
  }
  async deleteUsers(ids: readonly string[]) {
    this.deletedUsers.push([...ids])
    return ids.length
  }
  findInactiveAccounts(before: Date, limit: number) {
    return this.record('inactive', [before, limit], this.inactive)
  }
  async markInactivityNotice(userId: string, at: Date) {
    this.notices.set(userId, at)
  }
  clearNoticesOfReturnedPlayers() {
    return this.record('clear', [], 2)
  }
  deleteTerminalLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date) {
    return this.record('logs', [kinds, before], kinds.includes(TERMINAL_LOG_KIND.SECURITY) ? 1 : 10)
  }
  deleteEndedTerminalSessionsWithoutLogs(before: Date) {
    return this.record('sessions', [before], 3)
  }
  deleteEndedExecutionsBefore(before: Date) {
    return this.record('executions', [before], 4)
  }
  deleteExpiredAuthData(before: Date) {
    return this.record('auth', [before], 5)
  }
  deletePlayerActivityBefore(before: Date) {
    return this.record('activity', [before], 8)
  }
  deleteMetricHistoryBefore(before: Date) {
    return this.record('history', [before], 12)
  }
}

function setup(overrides: Partial<Record<RetentionJob, RetentionValues>> = {}) {
  const world = createWorld()
  const repository = new FakeLifecycleRepository()
  const notifier = { sendNotice: jest.fn(async () => undefined) }
  const notifications = { purge: jest.fn(async () => 6) }
  const status = new LifecycleStatus()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const jobs = { record: jest.fn(async () => undefined), list: jest.fn(async () => []) }
  const service = new LifecycleService({
    repository,
    unitOfWork: world.unitOfWork,
    notifier,
    notifications,
    settings: fakeRetentionPolicy(overrides),
    clock: world.clock,
    status,
    jobs,
    logger
  })
  return { ...world, repository, notifier, notifications, status, jobs, logger, service }
}

const account = (userId: string, noticeSentAt: Date | null = null): InactiveAccount => ({
  userId,
  name: 'Alice',
  email: `${userId}@example.com`,
  noticeSentAt
})

describe('LifecycleService', () => {
  it('stores the result of a pass for the console, and carries on when it cannot', async () => {
    const { service, jobs, logger, clock } = setup()

    await service.runOnce()
    expect(jobs.record).toHaveBeenCalledWith({
      name: 'lifecycle',
      lastRunAt: clock.now().getTime(),
      failures: 0,
      totals: expect.objectContaining({ terminalLogsDeleted: expect.any(Number) }),
      lastPass: expect.objectContaining({ terminalLogsDeleted: 11, playerActivityDeleted: 8, failedSteps: 0 })
    })

    jobs.record.mockRejectedValueOnce(new Error('database is down'))
    await expect(service.runOnce()).resolves.toBeDefined()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('database is down'))
  })

  it('applies each retention to its own cut-off date and reports what was removed', async () => {
    const { service, repository, clock } = setup()
    repository.unverified = ['u1', 'u2']
    const now = clock.now().getTime()

    const report = await service.runOnce()

    expect(report).toEqual({
      unverifiedAccountsDeleted: 2,
      inactivityNoticesSent: 0,
      inactiveAccountsErased: 0,
      terminalLogsDeleted: 11,
      terminalSessionsDeleted: 3,
      executionsDeleted: 4,
      notificationsDeleted: 6,
      authRowsDeleted: 5,
      playerActivityDeleted: 8,
      monitoringHistoryDeleted: 12
    })
    const cutoff = (name: string, index = 0) =>
      (repository.calls.filter(([call]) => call === name)[index][1] as Date[]).find(
        (arg) => arg instanceof Date
      ) as Date
    expect(now - cutoff('unverified').getTime()).toBe(7 * DAY)
    expect(now - cutoff('executions').getTime()).toBe(30 * DAY)
    expect(now - cutoff('auth').getTime()).toBe(7 * DAY)
    expect(now - cutoff('activity').getTime()).toBe(400 * DAY)
    expect(now - cutoff('history').getTime()).toBe(30 * DAY)
    expect(now - (repository.calls.find(([call]) => call === 'logs')![1][1] as Date).getTime()).toBe(30 * DAY)
    expect(now - (repository.calls.filter(([call]) => call === 'logs')[1][1][1] as Date).getTime()).toBe(90 * DAY)
    expect(repository.deletedUsers).toEqual([['u1', 'u2']])
  })

  it('does not ask to delete users when there are none to delete', async () => {
    const { service, repository } = setup()

    await service.runOnce()

    expect(repository.deletedUsers).toEqual([])
  })

  it('goes on with the other steps when one fails, and counts the failure', async () => {
    const { service, repository, logger, status } = setup()
    repository.failOn = 'executions'

    const report = await service.runOnce()

    expect(report.executionsDeleted).toBe(0)
    expect(report.authRowsDeleted).toBe(5)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('executions'))
    expect(status.snapshot().failures).toBe(1)
  })

  describe('what the console changes', () => {
    it('uses the values in force: other ranges give other cut-off dates', async () => {
      const { service, repository, clock } = setup({ executions: { days: 3 }, playerActivity: { days: 60 } })
      const now = clock.now().getTime()

      await service.runOnce()

      const cutoff = (name: string) => repository.calls.find(([call]) => call === name)![1][0] as Date
      expect(now - cutoff('executions').getTime()).toBe(3 * DAY)
      expect(now - cutoff('activity').getTime()).toBe(60 * DAY)
    })

    it('skips a step that is switched off, and does the others', async () => {
      const { service, repository, notifications } = setup({
        executions: { isEnabled: false },
        notifications: { isEnabled: false },
        playerActivity: { isEnabled: false }
      })

      const report = await service.runOnce()

      expect(repository.calls.some(([name]) => name === 'executions' || name === 'activity')).toBe(false)
      expect(notifications.purge).not.toHaveBeenCalled()
      expect(report).toMatchObject({ executionsDeleted: 0, authRowsDeleted: 5, playerActivityDeleted: 0 })
    })

    it('does nothing at all when the job itself is switched off, and tells the scheduler the interval', async () => {
      const { service, repository, jobs } = setup({ lifecycle: { isEnabled: false, intervalMinutes: 15 } })

      await service.runOnce()

      expect(repository.calls).toEqual([])
      expect(jobs.record).not.toHaveBeenCalled()
      expect(service.intervalMs(1)).toBe(15 * 60_000)
    })

    it('falls back to the configured interval before the first pass', () => {
      expect(setup().service.intervalMs(1234)).toBe(1234)
    })

    it('hands the days of notifications to the purge, and reports the failed steps', async () => {
      const { service, notifications, repository, jobs } = setup({ notifications: { days: 5 } })
      repository.failOn = 'executions'

      await service.runOnce()

      expect(notifications.purge).toHaveBeenCalledWith(5)
      expect(jobs.record).toHaveBeenCalledWith(
        expect.objectContaining({ lastPass: expect.objectContaining({ failedSteps: 1 }) })
      )
    })
  })

  describe('inactive accounts', () => {
    it('tells a player first, and erases nothing yet', async () => {
      const { service, repository, notifier, clock } = setup()
      repository.inactive = [account('u1')]

      const report = await service.runOnce()

      expect(report).toMatchObject({ inactivityNoticesSent: 1, inactiveAccountsErased: 0 })
      expect(notifier.sendNotice).toHaveBeenCalledWith(
        'u1@example.com',
        'Alice',
        new Date(clock.now().getTime() + 30 * DAY)
      )
      expect(repository.notices.get('u1')).toEqual(clock.now())
    })

    it('looks for players last active noticeDays before the end of the inactivity period', async () => {
      const { service, repository, clock } = setup()

      await service.runOnce()

      const [, [before]] = repository.calls.find(([name]) => name === 'inactive') as [string, [Date]]
      expect(clock.now().getTime() - before.getTime()).toBe((365 - 30) * DAY)
    })

    it('waits until the notice period has passed, then erases the personal data and keeps the row', async () => {
      const { service, repository, repositories, clock } = setup()
      const user = buildUser({ id: 'u1', name: 'Alice', email: 'alice@example.com' })
      await repositories.users.add(user)
      repository.inactive = [
        account('u1', new Date(clock.now().getTime() - 29 * DAY)),
        account('u2', new Date(clock.now().getTime() - 31 * DAY))
      ]
      await repositories.users.add(buildUser({ id: 'u2' }))

      const report = await service.runOnce()

      expect(report).toMatchObject({ inactivityNoticesSent: 0, inactiveAccountsErased: 1 })
      expect(await repositories.users.findById('u1')).toMatchObject({ name: 'Alice', deletedAt: null })
      expect(await repositories.users.findById('u2')).toMatchObject({
        name: 'Deleted player',
        email: 'deleted-u2@deleted.invalid',
        deletedAt: clock.now()
      })
    })

    it('skips an account that is already gone', async () => {
      const { service, repository, clock, repositories } = setup()
      repository.inactive = [
        account('ghost', new Date(clock.now().getTime() - 40 * DAY)),
        account('gone', new Date(clock.now().getTime() - 40 * DAY))
      ]
      await repositories.users.add(buildUser({ id: 'gone', deletedAt: new Date() }))

      expect(await service.runOnce()).toMatchObject({ inactiveAccountsErased: 0 })
    })

    it('is off when the inactivity period is 0', async () => {
      const { service, repository, notifier } = setup({ inactiveAccounts: { isEnabled: false } })
      repository.inactive = [account('u1')]

      await service.runOnce()

      expect(notifier.sendNotice).not.toHaveBeenCalled()
      expect(repository.calls.map(([name]) => name)).not.toContain('inactive')
    })
  })

  it('keeps a status that the metrics show', async () => {
    const { service, status, clock } = setup()
    await service.runOnce()
    await service.runOnce()
    const text = new PrometheusText()

    collectLifecycleMetrics(status)(text)
    const out = text.toString()

    expect(out).toContain(`botrts_lifecycle_last_run_timestamp_seconds ${Math.floor(clock.now().getTime() / 1000)}`)
    expect(out).toContain('botrts_lifecycle_executions_deleted_total 8')
    expect(out).toContain('botrts_lifecycle_step_failures_total 0')
  })

  it('reports "never" before the first pass', () => {
    const text = new PrometheusText()

    collectLifecycleMetrics(new LifecycleStatus())(text)

    expect(text.toString()).toContain('botrts_lifecycle_last_run_timestamp_seconds 0')
  })
})
