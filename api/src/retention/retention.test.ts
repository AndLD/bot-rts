import { RETENTION_JOBS, retentionProblems } from '../../../lib/utils/admin-retention'
import { FakeClock } from '../../tests/fakes/fakes'
import { DEFAULT_RETENTION } from '../../tests/fakes/retention'
import { DEFAULT_LIFECYCLE_POLICY } from '../lifecycle/domain/lifecycle-policy'
import { loadConfig } from '../config/app-config'
import { liveTerminalRetention } from '../terminal/domain/terminal-retention'
import { ValidationError } from '../shared/domain/errors'
import {
  LogRetention,
  mergeRetention,
  RetentionOverrides,
  RetentionSettingsService,
  RetentionStore
} from './application/retention-settings.service'
import { retentionDefaults } from './domain/retention-defaults'
import { RetentionController } from './presentation/retention.controller'

class MemoryStore implements RetentionStore {
  overrides: RetentionOverrides = {}
  updatedAt: Date | null = null
  saves: Array<RetentionOverrides | null> = []

  async load() {
    return { overrides: this.overrides, updatedAt: this.updatedAt }
  }

  async save(overrides: RetentionOverrides | null, at: Date) {
    this.saves.push(overrides)
    this.overrides = overrides ?? {}
    this.updatedAt = overrides ? at : null
  }
}

function setup(cacheMs = 1000, logRetention?: LogRetention) {
  const store = new MemoryStore()
  const clock = new FakeClock()
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const service = new RetentionSettingsService(store, DEFAULT_RETENTION, clock, cacheMs, logger, logRetention)

  return { store, clock, logger, service }
}

describe('retentionProblems', () => {
  it('accepts a value inside its range and the switch', () => {
    expect(retentionProblems('executions', { days: 10, isEnabled: false })).toEqual([])
  })

  it.each([
    ['executions', { days: 0 }, 'executions.days'],
    ['executions', { days: 1000 }, 'executions.days'],
    ['executions', { days: 2.5 }, 'executions.days'],
    ['executions', { days: '10' }, 'executions.days'],
    ['executions', { isEnabled: 'yes' }, 'executions.isEnabled'],
    ['executions', { nothing: 1 }, 'executions.nothing'],
    ['monitoring', { isEnabled: false }, 'monitoring.isEnabled'],
    ['logs', { days: 0 }, 'logs.days'],
    ['logs', { days: 400 }, 'logs.days'],
    ['logs', { isEnabled: false }, 'logs.isEnabled']
  ])('refuses %s %j', (job, patch, mention) => {
    const [problem] = retentionProblems(job as never, patch)

    expect(problem).toContain(mention)
  })
})

describe('the defaults', () => {
  it('come from the environment', () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'test', INACTIVE_ACCOUNT_DAYS: '0' })
    const defaults = retentionDefaults(config)

    expect(defaults.lifecycle.intervalMinutes).toBe(DEFAULT_LIFECYCLE_POLICY.intervalMs / 60_000)
    expect(defaults.playerActivity).toEqual({ isEnabled: true, days: 400 })
    expect(defaults.inactiveAccounts).toMatchObject({ isEnabled: false, inactiveDays: 365 })
    expect(defaults.monitoring).toEqual({ fineDays: 7, coarseDays: 30 })
    expect(defaults.logs).toEqual({ days: 14 })
    expect(Object.keys(defaults)).toEqual([...RETENTION_JOBS])
  })

  it('start the erasure on when the environment has a number of days for it', () => {
    const config = loadConfig({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'test', INACTIVE_ACCOUNT_DAYS: '200' })

    expect(retentionDefaults(config).inactiveAccounts).toMatchObject({ isEnabled: true, inactiveDays: 200 })
  })

  it('are overlaid by the stored values, and a stored field that does not exist is ignored', () => {
    const merged = mergeRetention(DEFAULT_RETENTION, {
      executions: { days: 5, gone: 3 },
      authData: { isEnabled: false }
    })

    expect(merged.executions).toEqual({ isEnabled: true, days: 5 })
    expect(merged.authData.isEnabled).toBe(false)
    expect(merged.notifications).toEqual(DEFAULT_RETENTION.notifications)
  })
})

describe('RetentionSettingsService', () => {
  it('reads the values in force from the store every time current() is called', async () => {
    const { service, store } = setup()

    expect((await service.current()).executions.days).toBe(30)
    store.overrides = { executions: { days: 3 } }
    expect((await service.current()).executions.days).toBe(3)
  })

  it('changes only the named fields, keeps the earlier ones, and returns before and after', async () => {
    const { service, store } = setup()
    await service.update({ executions: { days: 3 } }, undefined)

    const { before, after } = await service.update(
      { executions: { isEnabled: false }, authData: { days: 2 } },
      undefined
    )

    expect(before.executions).toEqual({ isEnabled: true, days: 3 })
    expect(after.executions).toEqual({ isEnabled: false, days: 3 })
    expect(after.authData.days).toBe(2)
    expect(store.overrides).toEqual({ executions: { days: 3, isEnabled: false }, authData: { days: 2 } })
  })

  it.each([
    [{}, 'Name at least one setting'],
    [{ unknown: { days: 3 } }, 'unknown is not a retention job'],
    [{ executions: {} }, 'executions is not a retention job'],
    [{ executions: { days: 0 } }, 'executions.days'],
    [{ executions: { days: 3 }, authData: { days: 1000 } }, 'authData.days']
  ])('refuses the patch %j', async (patch, message) => {
    const { service, store } = setup()

    await expect(service.update(patch as never, undefined)).rejects.toThrow(ValidationError)
    await expect(service.update(patch as never, undefined)).rejects.toThrow(message)
    expect(store.saves).toEqual([])
  })

  it('needs the typed word to switch the erasure of inactive accounts on, and not to switch it off', async () => {
    const { service, store } = setup()
    store.overrides = { inactiveAccounts: { isEnabled: false } }

    await expect(service.update({ inactiveAccounts: { isEnabled: true } }, undefined)).rejects.toThrow('ERASE')
    await expect(service.update({ inactiveAccounts: { isEnabled: true } }, 'erase')).rejects.toThrow('ERASE')
    await service.update({ inactiveAccounts: { isEnabled: true } }, 'ERASE')
    await service.update({ inactiveAccounts: { isEnabled: false } }, undefined)
    // Changing a range of an erasure that is already on needs no word
    store.overrides = {}
    await service.update({ inactiveAccounts: { inactiveDays: 500 } }, undefined)
  })

  it('puts everything back with reset()', async () => {
    const { service, store } = setup()
    await service.update({ executions: { days: 3 } }, undefined)

    const { before, after } = await service.reset()

    expect(before.executions.days).toBe(3)
    expect(after).toEqual(DEFAULT_RETENTION)
    expect(store.saves[store.saves.length - 1]).toBeNull()
    expect((await service.current()).executions.days).toBe(30)
  })

  it('answers snapshot() at once, and refreshes it in the background when it is old', async () => {
    const { service, store, clock, logger } = setup(1000)
    expect(service.snapshot().executions.days).toBe(30)
    await new Promise((resolve) => setImmediate(resolve))
    store.overrides = { executions: { days: 3 } }

    expect(service.snapshot().executions.days).toBe(30)
    clock.current = new Date(clock.current.getTime() + 1001)
    service.snapshot()
    service.snapshot()
    await new Promise((resolve) => setImmediate(resolve))

    expect(service.snapshot().executions.days).toBe(3)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('logs a store that cannot be read and keeps the last values', async () => {
    const { service, store, clock, logger } = setup(0)
    store.load = async () => {
      throw new Error('down')
    }
    clock.current = new Date(clock.current.getTime() + 5)

    service.snapshot()
    await new Promise((resolve) => setImmediate(resolve))

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('down'))
    expect(service.snapshot().executions.days).toBe(30)
  })

  it('exposes its defaults', () => {
    expect(setup().service.getDefaults()).toBe(DEFAULT_RETENTION)
  })
})

describe('the retention of the logs', () => {
  it('starts from the environment, held to the ceiling of its range', () => {
    const base = { DATABASE_URL: 'postgresql://x', NODE_ENV: 'test' }

    expect(retentionDefaults(loadConfig({ ...base, LOG_RETENTION_DAYS: '30' })).logs).toEqual({ days: 30 })
    expect(retentionDefaults(loadConfig({ ...base, LOG_RETENTION_DAYS: '9999' })).logs).toEqual({ days: 365 })
  })

  it('is put into force in the log store before it is saved, and only when it changed', async () => {
    const order: string[] = []
    const logs: LogRetention = { apply: jest.fn(async (days: number) => void order.push(`apply ${days}`)) }
    const { service, store } = setup(1000, logs)
    const save = store.save.bind(store)
    store.save = async (...args) => {
      order.push('save')
      return save(...args)
    }

    await service.update({ executions: { days: 10 } }, undefined)
    expect(logs.apply).not.toHaveBeenCalled()
    await service.update({ logs: { days: 30 } }, undefined)

    expect(order).toEqual(['save', 'apply 30', 'save'])
    expect((await service.current()).logs).toEqual({ days: 30 })
  })

  it('saves nothing when the log store cannot take the change', async () => {
    const logs: LogRetention = { apply: jest.fn().mockRejectedValue(new Error('refused')) }
    const { service, store } = setup(1000, logs)

    await expect(service.update({ logs: { days: 30 } }, undefined)).rejects.toThrow('refused')

    expect(store.saves).toEqual([])
    expect((await service.current()).logs).toEqual({ days: 14 })
  })

  it('puts the default back into the log store with reset(), when the days were changed', async () => {
    const logs: LogRetention = { apply: jest.fn(async () => undefined) }
    const { service } = setup(1000, logs)

    await service.reset()
    expect(logs.apply).not.toHaveBeenCalled()
    await service.update({ logs: { days: 30 } }, undefined)
    await service.reset()

    expect(logs.apply).toHaveBeenLastCalledWith(14)
  })

  it('is only kept when there is no log store to change', async () => {
    const { service } = setup()

    await service.update({ logs: { days: 3 } }, undefined)

    expect((await service.current()).logs).toEqual({ days: 3 })
  })
})

describe('liveTerminalRetention', () => {
  it('reads the values in force on every use', () => {
    let values: Record<string, number | boolean> = { logDays: 30, securityDays: 90, maxLinesPerBot: 5000 }
    const live = liveTerminalRetention({ snapshot: () => ({ terminalLogs: values }) })

    expect(live).toMatchObject({ logDays: 30, securityDays: 90, maxLinesPerBot: 5000 })
    values = { logDays: 3, securityDays: 9, maxLinesPerBot: 500 }
    expect(live).toMatchObject({ logDays: 3, securityDays: 9, maxLinesPerBot: 500 })
  })
})

describe('RetentionController', () => {
  function controller(statuses: unknown[] = []) {
    const { service, store } = setup()
    const jobs = { list: async () => statuses, record: jest.fn() }

    return { controller: new RetentionController(service, jobs as never), store }
  }

  it('shows every job with its values, its defaults and what it removed in the last pass', async () => {
    const { controller: c } = controller([
      {
        name: 'lifecycle',
        lastRunAt: 5,
        failures: 0,
        totals: {},
        lastPass: { terminalLogsDeleted: 4, terminalSessionsDeleted: 1, executionsDeleted: 2, failedSteps: 1 }
      }
    ])

    const view = await c.get()

    expect(view.jobs.map((job) => job.job)).toEqual([...RETENTION_JOBS])
    expect(view.jobs.find((job) => job.job === 'terminalLogs')).toMatchObject({ lastRemoved: 5, isOverridden: false })
    expect(view.jobs.find((job) => job.job === 'executions')?.lastRemoved).toBe(2)
    expect(view.jobs.find((job) => job.job === 'lifecycle')?.lastRemoved).toBeNull()
    expect(view).toMatchObject({ lastRunAt: 5, hasFailures: true, updatedAt: null })
  })

  it('shows nothing removed before a pass was reported, and marks an overridden job', async () => {
    const { controller: c } = controller([{ name: 'lifecycle', lastRunAt: 5, failures: 0, totals: {} }])
    await c.update({}, { jobs: { executions: { days: 3 } }, reason: 'smaller' })

    const view = await c.get()

    expect(view.jobs.find((job) => job.job === 'executions')).toMatchObject({ lastRemoved: null, isOverridden: true })
    expect(view.hasFailures).toBe(false)
    expect(view.updatedAt).toEqual(expect.any(Number))
  })

  it('records a change and a reset for the audit trail with the reason', async () => {
    const { controller: c } = controller()
    const detail = {}

    await c.update(detail, { jobs: { executions: { days: 3 } }, reason: 'smaller' })
    expect(detail).toMatchObject({ targetId: 'retention', reason: 'smaller' })
    expect((detail as { after: typeof DEFAULT_RETENTION }).after.executions.days).toBe(3)

    const resetDetail = {}
    await c.reset(resetDetail, { reason: 'back' })
    expect((resetDetail as { before: typeof DEFAULT_RETENTION }).before.executions.days).toBe(3)
    expect((resetDetail as { after: typeof DEFAULT_RETENTION }).after.executions.days).toBe(30)
  })
})
