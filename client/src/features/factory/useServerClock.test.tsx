import { act, renderHook } from '@testing-library/react'
import { useServerClock } from './useServerClock'

describe('useServerClock', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(1_000_000)
  })
  afterEach(() => jest.useRealTimers())

  it('knows nothing until the server has said the time', () => {
    const { result } = renderHook(() => useServerClock(undefined))

    expect(result.current).toBeUndefined()
  })

  it('counts on from the time the server said', () => {
    const { result } = renderHook(() => useServerClock(5_000_000))
    expect(result.current).toBe(5_000_000)

    act(() => void jest.advanceTimersByTime(3000))

    expect(result.current).toBe(5_003_000)
  })

  it('takes a new time when the server says one', () => {
    const { result, rerender } = renderHook(({ time }) => useServerClock(time), { initialProps: { time: 5_000_000 } })

    rerender({ time: 7_000_000 })

    expect(result.current).toBe(7_000_000)
  })
})
