import { SYSTEM_TIMERS, TickLoop, Timers } from './tick-loop'

// A clock the test moves by hand; timers fire when it is advanced past their time
class ManualTimers implements Timers {
  time = 0
  private pending: Array<{ at: number; callback: () => void }> = []

  now() {
    return this.time
  }

  after(delayMs: number, callback: () => void) {
    const entry = { at: this.time + delayMs, callback }
    this.pending.push(entry)
    return () => void (this.pending = this.pending.filter((candidate) => candidate !== entry))
  }

  async advance(ms: number) {
    this.time += ms
    const due = this.pending.filter((entry) => entry.at <= this.time)
    this.pending = this.pending.filter((entry) => entry.at > this.time)
    due.forEach((entry) => entry.callback())
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe('TickLoop', () => {
  it('ticks once per interval', async () => {
    const timers = new ManualTimers()
    const onTick = jest.fn(async () => undefined)
    const loop = new TickLoop(onTick, jest.fn(), 100, timers)

    loop.start()
    expect(loop.isRunning).toBe(true)
    await timers.advance(99)
    expect(onTick).toHaveBeenCalledTimes(0)
    await timers.advance(1)
    expect(onTick).toHaveBeenCalledTimes(1)
    await timers.advance(100)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('starts only once and stops for good', async () => {
    const timers = new ManualTimers()
    const onTick = jest.fn(async () => undefined)
    const loop = new TickLoop(onTick, jest.fn(), 100, timers)

    loop.start()
    loop.start()
    await timers.advance(100)
    loop.stop()
    await timers.advance(1000)

    expect(onTick).toHaveBeenCalledTimes(1)
    expect(loop.isRunning).toBe(false)
  })

  it('keeps the rate after a slow tick by waiting less, and does not catch up lost ticks', async () => {
    const timers = new ManualTimers()
    const delays: number[] = []
    const after = timers.after.bind(timers)
    timers.after = (delayMs, callback) => {
      delays.push(delayMs)
      return after(delayMs, callback)
    }
    const onTick = jest.fn(async () => {
      timers.time += 30
    })
    const loop = new TickLoop(onTick, jest.fn(), 100, timers)

    loop.start()
    await timers.advance(100)
    expect(delays).toEqual([100, 70])

    timers.time += 500
    await timers.advance(1)
    expect(delays[delays.length - 1]).toBe(0)
    loop.stop()
  })

  it('reports a failing tick and goes on', async () => {
    const timers = new ManualTimers()
    const onError = jest.fn()
    const onTick = jest.fn().mockRejectedValueOnce(new Error('tick failed')).mockResolvedValue(undefined)
    const loop = new TickLoop(onTick, onError, 100, timers)

    loop.start()
    await timers.advance(100)
    await timers.advance(100)

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'tick failed' }))
    expect(onTick).toHaveBeenCalledTimes(2)
    loop.stop()
  })

  it('does not schedule another tick when it was stopped during one', async () => {
    const timers = new ManualTimers()
    const onTick = jest.fn(async () => loop.stop())
    const loop: TickLoop = new TickLoop(onTick, jest.fn(), 100, timers)

    loop.start()
    await timers.advance(100)
    await timers.advance(1000)

    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('uses the real clock and timers by default', async () => {
    const before = SYSTEM_TIMERS.now()
    const fired = jest.fn()
    const cancel = SYSTEM_TIMERS.after(1, fired)
    const cancelled = jest.fn()
    SYSTEM_TIMERS.after(1, cancelled)()
    await new Promise((resolve) => setTimeout(resolve, 10))
    cancel()

    expect(fired).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
    expect(SYSTEM_TIMERS.now()).toBeGreaterThanOrEqual(before)
  })
})
