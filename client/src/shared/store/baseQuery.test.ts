import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { makeJwt } from '../../../tests/jwt'
import { setupStore } from '.'
import { setToken } from './session.slice'
import { baseQueryWithRefresh } from './baseQuery'

jest.mock('@reduxjs/toolkit/query/react', () => {
  const base = jest.fn()

  return { ...jest.requireActual('@reduxjs/toolkit/query/react'), fetchBaseQuery: jest.fn(() => base) }
})

// What baseQuery.ts handed to fetchBaseQuery when it was imported, and the fetching function it got back
type Options = { prepareHeaders: (headers: Headers, api: { getState: () => unknown }) => Headers }
const [[options]] = jest.mocked(fetchBaseQuery).mock.calls as unknown as [[Options]]
const mockFetch = jest.mocked(fetchBaseQuery).mock.results[0].value as jest.Mock

function run(store = setupStore()) {
  const api = {
    getState: store.getState,
    dispatch: store.dispatch,
    signal: new AbortController().signal,
    abort: jest.fn(),
    extra: undefined,
    endpoint: 'test',
    type: 'query' as const
  }

  return baseQueryWithRefresh('/api/v1/users/me', api, {})
}

describe('baseQueryWithRefresh', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  it('sends the access token as a bearer header', () => {
    const store = setupStore()
    store.dispatch(setToken('abc'))
    const headers = options.prepareHeaders(new Headers(), { getState: store.getState })

    expect(headers.get('Authorization')).toBe('Bearer abc')
  })

  it('sends no header without a token', () => {
    const headers = options.prepareHeaders(new Headers(), { getState: setupStore().getState })

    expect(headers.has('Authorization')).toBe(false)
  })

  it('passes the request through when the token is still valid', async () => {
    const store = setupStore()
    store.dispatch(setToken(makeJwt(60)))
    mockFetch.mockResolvedValue({ data: 'me' })

    expect(await run(store)).toEqual({ data: 'me' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('passes the request through when there is no token', async () => {
    mockFetch.mockResolvedValue({ data: 'anything' })

    await run()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('refreshes an expired token before the request', async () => {
    const store = setupStore()
    store.dispatch(setToken(makeJwt(-10)))
    mockFetch.mockResolvedValueOnce({ data: { accessToken: 'fresh' } }).mockResolvedValueOnce({ data: 'me' })

    expect(await run(store)).toEqual({ data: 'me' })
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ url: '/api/v1/auth/refresh', method: 'POST' })
    expect(store.getState().session.token).toBe('fresh')
  })

  it('ends the session when the refresh fails', async () => {
    const store = setupStore()
    store.dispatch(setToken(makeJwt(-10)))
    mockFetch
      .mockResolvedValueOnce({ error: { status: 401 } })
      .mockResolvedValueOnce({ data: '' })
      .mockResolvedValueOnce({ error: { status: 401 } })

    expect(await run(store)).toEqual({ error: { status: 401 } })
    expect(mockFetch.mock.calls[1][0]).toMatchObject({ url: '/api/v1/auth/logout', method: 'POST' })
    expect(store.getState().session.token).toBeNull()
  })
})
