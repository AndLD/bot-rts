import { act, renderHook } from '@testing-library/react'
import { useSystemReducedMotion } from './useSystemReducedMotion'

describe('useSystemReducedMotion', () => {
  it('follows the system setting', () => {
    const listeners = new Set<() => void>()
    const media = {
      matches: false,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener)
    }
    window.matchMedia = jest.fn(() => media) as never

    const { result, unmount } = renderHook(() => useSystemReducedMotion())
    expect(result.current).toBe(false)

    media.matches = true
    act(() => listeners.forEach((listener) => listener()))
    expect(result.current).toBe(true)

    unmount()
    expect(listeners.size).toBe(0)
  })

  it('is false where the browser cannot tell', () => {
    window.matchMedia = undefined as never
    const { result } = renderHook(() => useSystemReducedMotion())

    expect(result.current).toBe(false)
  })
})
