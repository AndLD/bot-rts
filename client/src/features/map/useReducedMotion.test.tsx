import { act, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { renderAppHook, storeWithToken } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { useReducedMotion } from './useReducedMotion'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
const query = jest.mocked(baseQueryWithRefresh)

function mockMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener)
  }
  window.matchMedia = jest.fn(() => media) as never

  return {
    change: (next: boolean) => {
      media.matches = next
      listeners.forEach((listener) => listener())
    },
    listeners
  }
}

const settings = (reducedMotion: boolean | null) => ({ data: { user: { reducedMotion } } })

function setup() {
  return renderAppHook(() => useReducedMotion(), { store: storeWithToken(makeJwt(60)) })
}

describe('useReducedMotion', () => {
  beforeEach(() => query.mockReset())

  it('follows the system while the player has no setting, and its changes', async () => {
    const media = mockMedia(true)
    query.mockResolvedValue(settings(null) as never)
    const { result } = setup()

    expect(result.current).toBe(true)
    await act(async () => undefined)
    act(() => media.change(false))
    expect(result.current).toBe(false)
  })

  it.each([
    [true, false, true],
    [false, true, false]
  ])("takes the player's own setting over the system (%p over %p)", async (own, system, expected) => {
    mockMedia(system)
    query.mockResolvedValue(settings(own) as never)
    const { result } = setup()

    await waitFor(() => expect(result.current).toBe(expected))
  })

  it('stops listening to the system when it goes away', async () => {
    const media = mockMedia(false)
    query.mockResolvedValue(settings(null) as never)
    const { unmount } = setup()

    unmount()

    expect(media.listeners.size).toBe(0)
  })

  it('copes with a browser that cannot tell', async () => {
    window.matchMedia = undefined as never
    query.mockResolvedValue(settings(null) as never)

    const { result, unmount } = setup()

    expect(result.current).toBe(false)
    unmount()
  })
})
