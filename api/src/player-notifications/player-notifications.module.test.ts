import { fakeRetentionPolicy } from '../../tests/fakes/retention'
import { testTelemetry } from '../../tests/fakes/telemetry'
import { DELIVER_DUE_MS, PlayerNotificationsModule, PURGE_MS } from './player-notifications.module'

function setup(retentionOverrides: Parameters<typeof fakeRetentionPolicy>[0] = {}) {
  const traced = testTelemetry()
  const unlock = jest.fn()
  const off = jest.fn()
  const notifications = {
    achievementUnlocked: jest.fn(async () => undefined),
    deliverDue: jest.fn(async () => undefined),
    purge: jest.fn(async () => 0)
  }
  const achievements = {
    onUnlocked: jest.fn((listener: (userId: string, unlock: unknown) => void) => {
      unlock.mockImplementation(listener)
      return off
    })
  }
  const logger = { error: jest.fn() }
  const retention = fakeRetentionPolicy(retentionOverrides)
  const module = new PlayerNotificationsModule(
    notifications as never,
    achievements as never,
    logger as never,
    retention,
    traced.telemetry.tracing
  )

  return { module, notifications, unlock, off, logger, retention, traced }
}

describe('PlayerNotificationsModule', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('tells of the achievements that are unlocked, delivers what is due and forgets what is old, on timers', async () => {
    const { module, notifications, unlock } = setup()
    module.onApplicationBootstrap()

    unlock('alice', { id: 'firstSteps' })
    jest.advanceTimersByTime(DELIVER_DUE_MS)
    await jest.advanceTimersByTimeAsync(PURGE_MS)

    expect(notifications.achievementUnlocked).toHaveBeenCalledWith('alice', { id: 'firstSteps' })
    expect(notifications.deliverDue).toHaveBeenCalled()
    expect(notifications.purge).toHaveBeenCalledTimes(1)
    expect(notifications.purge).toHaveBeenCalledWith(30)
    module.onApplicationShutdown()
  })

  it('runs each timer in a trace of its own', async () => {
    const { module, traced } = setup()
    module.onApplicationBootstrap()

    await jest.advanceTimersByTimeAsync(PURGE_MS)

    const names = new Set(traced.spans().map((span) => span.name))
    expect(names).toEqual(new Set(['job notifications-deliver', 'job notifications-purge']))
    expect(traced.spans().every((span) => span.parentSpanContext === undefined)).toBe(true)
    module.onApplicationShutdown()
  })

  it('keeps the notifications when the console switched the retention off', async () => {
    const { module, notifications } = setup({ notifications: { isEnabled: false } })
    module.onApplicationBootstrap()

    await jest.advanceTimersByTimeAsync(PURGE_MS)

    expect(notifications.purge).not.toHaveBeenCalled()
    module.onApplicationShutdown()
  })

  it('logs a failure of a timer and keeps going', async () => {
    const { module, notifications, logger } = setup()
    notifications.deliverDue.mockRejectedValueOnce(new Error('down'))
    notifications.purge.mockRejectedValueOnce(new Error('down'))
    module.onApplicationBootstrap()

    await jest.advanceTimersByTimeAsync(PURGE_MS)

    expect(logger.error).toHaveBeenCalledTimes(2)
    module.onApplicationShutdown()
  })

  it('stops its timers and its listening on shutdown', () => {
    const { module, notifications, off } = setup()
    module.onApplicationBootstrap()

    module.onApplicationShutdown()
    jest.advanceTimersByTime(PURGE_MS)

    expect(off).toHaveBeenCalled()
    expect(notifications.deliverDue).not.toHaveBeenCalled()
  })
})
