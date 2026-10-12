import { SystemDelay } from './system-delay'

describe('SystemDelay', () => {
  it('waits for the time given', async () => {
    jest.useFakeTimers()
    const done = jest.fn()

    const waiting = new SystemDelay().wait(500).then(done)
    await jest.advanceTimersByTimeAsync(499)
    expect(done).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    await waiting

    expect(done).toHaveBeenCalled()
    jest.useRealTimers()
  })
})
