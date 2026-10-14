import { LifecycleScheduler } from './lifecycle-scheduler'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('LifecycleScheduler', () => {
  it('runs after the first delay and then every interval', async () => {
    const run = jest.fn(async () => undefined)
    const scheduler = new LifecycleScheduler(run, 1000, 100)
    scheduler.start()

    await jest.advanceTimersByTimeAsync(99)
    expect(run).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(2000)
    expect(run).toHaveBeenCalledTimes(3)
    scheduler.stop()
  })

  it('goes on after a failing pass', async () => {
    const run = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const scheduler = new LifecycleScheduler(run, 1000, 10)
    scheduler.start()

    await jest.advanceTimersByTimeAsync(1100)

    expect(run).toHaveBeenCalledTimes(2)
    scheduler.stop()
  })

  it('never starts a pass while the previous one is still running', async () => {
    let finish: () => void = () => undefined
    const run = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const scheduler = new LifecycleScheduler(run, 100, 10)
    scheduler.start()

    await jest.advanceTimersByTimeAsync(10)
    expect(run).toHaveBeenCalledTimes(1)
    finish()
    await jest.advanceTimersByTimeAsync(0)
    await jest.advanceTimersByTimeAsync(100)
    expect(run).toHaveBeenCalledTimes(2)
    scheduler.stop()
  })

  it('stops, also while a pass is running', async () => {
    let finish: () => void = () => undefined
    const run = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    const scheduler = new LifecycleScheduler(run, 100, 10)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(10)

    scheduler.stop()
    finish()
    await jest.advanceTimersByTimeAsync(1000)

    expect(run).toHaveBeenCalledTimes(1)
    scheduler.stop()
  })

  it('does not run once stopped before the first pass', async () => {
    const run = jest.fn(async () => undefined)
    const scheduler = new LifecycleScheduler(run, 100, 10)
    scheduler.start()
    scheduler.stop()

    await jest.advanceTimersByTimeAsync(1000)

    expect(run).not.toHaveBeenCalled()
  })
})
