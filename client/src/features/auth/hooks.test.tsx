import { act, waitFor } from '@testing-library/react'
import { makeJwt } from '../../../tests/jwt'
import { createFakeAuth, renderAppHook } from '../../../tests/render'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'
import { setupStore } from '../../shared/store'
import { setToken } from '../../shared/store/session.slice'
import { errorNotification } from '../../shared/notifications'
import { useCurrentUser, useLogout, useRefreshSession, useVerifyEmail } from './hooks'

jest.mock('../../shared/store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))
jest.mock('../../shared/notifications', () => ({ errorNotification: jest.fn() }))

const query = jest.mocked(baseQueryWithRefresh)

function signedInStore() {
  const store = setupStore()
  store.dispatch(setToken(makeJwt(60)))

  return store
}

describe('useCurrentUser', () => {
  beforeEach(() => {
    query.mockReset()
    localStorage.clear()
  })

  it('is anonymous without a token', () => {
    const { result } = renderAppHook(useCurrentUser)

    expect(result.current).toEqual({ state: 'anonymous' })
    expect(query).not.toHaveBeenCalled()
  })

  it('is loading while the server answers, then active', async () => {
    query.mockResolvedValue({ data: { _id: 'u1', name: 'Jon' } })
    const { result } = renderAppHook(useCurrentUser, { store: signedInStore() })

    expect(result.current).toEqual({ state: 'loading' })
    await waitFor(() => expect(result.current).toEqual({ state: 'active', user: { _id: 'u1', name: 'Jon' } }))
  })

  it('is unverified when the email is not confirmed', async () => {
    query.mockResolvedValue({ error: { status: 403, data: { code: 'EMAIL_NOT_VERIFIED' } } })
    const { result } = renderAppHook(useCurrentUser, { store: signedInStore() })

    await waitFor(() => expect(result.current).toEqual({ state: 'unverified' }))
  })

  it('is blocked for a banned player', async () => {
    query.mockResolvedValue({ error: { status: 403, data: { code: 'USER_BANNED' } } })
    const { result } = renderAppHook(useCurrentUser, { store: signedInStore() })

    await waitFor(() => expect(result.current).toEqual({ state: 'blocked' }))
  })

  it('drops a token the server rejected', async () => {
    query.mockResolvedValue({ error: { status: 401, data: undefined } } as never)
    const store = signedInStore()
    const { result } = renderAppHook(useCurrentUser, { store })

    await waitFor(() => expect(store.getState().session.token).toBeNull())
    expect(result.current).toEqual({ state: 'anonymous' })
  })

  it('is anonymous after any other failure', async () => {
    query.mockResolvedValue({ error: { status: 500, data: undefined } } as never)
    const { result } = renderAppHook(useCurrentUser, { store: signedInStore() })

    await waitFor(() => expect(result.current).toEqual({ state: 'anonymous' }))
  })
})

describe('useLogout / useRefreshSession', () => {
  it('signs out and then calls the callback', async () => {
    const auth = createFakeAuth()
    const done = jest.fn()
    const { result } = renderAppHook(useLogout, { auth })

    await act(() => result.current(done))

    expect(auth.signOut).toHaveBeenCalled()
    expect(done).toHaveBeenCalled()
  })

  it('signs out without a callback', async () => {
    const auth = createFakeAuth()
    const { result } = renderAppHook(useLogout, { auth })

    await act(() => result.current())

    expect(auth.signOut).toHaveBeenCalled()
  })

  it('refreshes through the auth client', async () => {
    const auth = createFakeAuth()
    const { result } = renderAppHook(useRefreshSession, { auth })

    expect(await result.current()).toBe('refreshed-token')
  })
})

describe('useVerifyEmail', () => {
  beforeEach(() => jest.mocked(errorNotification).mockClear())

  it('does nothing without a token', () => {
    const auth = createFakeAuth()
    renderAppHook(() => useVerifyEmail(null, jest.fn()), { auth })

    expect(auth.verifyEmail).not.toHaveBeenCalled()
  })

  it('confirms the email once and reports completion', async () => {
    const auth = createFakeAuth()
    const done = jest.fn()
    const { rerender } = renderAppHook(() => useVerifyEmail('tok', done), { auth })

    await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
    rerender()

    expect(auth.verifyEmail).toHaveBeenCalledTimes(1)
    expect(auth.verifyEmail).toHaveBeenCalledWith('tok')
    expect(errorNotification).not.toHaveBeenCalled()
  })

  it('tells the player when the confirmation failed, and still completes', async () => {
    const auth = createFakeAuth({ verifyEmail: jest.fn(() => Promise.resolve({ ok: false as const, failure: {} })) })
    const done = jest.fn()
    renderAppHook(() => useVerifyEmail('tok', done), { auth })

    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(errorNotification).toHaveBeenCalledWith('Email confirmation failed')
  })
})
