import { DELIVER_DUE_MS, PlayerNotificationsModule, PURGE_MS } from './player-notifications.module'

function setup() {
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
  const module = new PlayerNotificationsModule(notifications as never, achievements as never, logger as never)

  return { module, notifications, unlock, off, logger }
}

describe('PlayerNotificationsModule', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('tells of the achievements that are unlocked, delivers what is due and forgets what is old, on timers', () => {
    const { module, notifications, unlock } = setup()
    module.onApplicationBootstrap()

    unlock('alice', { id: 'firstSteps' })
    jest.advanceTimersByTime(DELIVER_DUE_MS)
    jest.advanceTimersByTime(PURGE_MS)

    expect(notifications.achievementUnlocked).toHaveBeenCalledWith('alice', { id: 'firstSteps' })
    expect(notifications.deliverDue).toHaveBeenCalled()
    expect(notifications.purge).toHaveBeenCalledTimes(1)
    module.onApplicationShutdown()
  })

  it('logs a failure of a timer and keeps going', async () => {
    const { module, notifications, logger } = setup()
    notifications.deliverDue.mockRejectedValueOnce(new Error('down'))
    notifications.purge.mockRejectedValueOnce(new Error('down'))
    module.onApplicationBootstrap()

    jest.advanceTimersByTime(PURGE_MS)
    await Promise.resolve()
    await Promise.resolve()

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
