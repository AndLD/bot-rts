import { FetchArgs } from '@reduxjs/toolkit/query'
import { setupStore } from '../store'
import { baseQueryWithRefresh } from '../store/baseQuery'
import { emptyApi } from './empty-api'

jest.mock('../store/baseQuery', () => ({ baseQueryWithRefresh: jest.fn() }))

const NETWORK_DOWN = { error: { status: 'FETCH_ERROR', error: 'Failed to fetch' } }

function setup() {
  const store = setupStore()
  const api = emptyApi.injectEndpoints({
    endpoints: (builder) => ({
      read: builder.query<string, void>({ query: () => '/api/v1/read' }),
      bare: builder.query<string, void>({ query: () => ({ url: '/api/v1/bare' }) }),
      named: builder.query<string, void>({ query: () => ({ url: '/api/v1/named', method: 'get' }) }),
      write: builder.mutation<string, void>({ query: () => ({ url: '/api/v1/write', method: 'POST' }) })
    }),
    overrideExisting: true
  })

  return { store, api }
}

const calls = () => jest.mocked(baseQueryWithRefresh).mock.calls.map(([args]) => args as FetchArgs | string)

describe('the retries of the API', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(baseQueryWithRefresh).mockReset()
  })
  afterEach(() => jest.useRealTimers())

  it('reads again a request that never reached the server, until it gets through', async () => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockResolvedValueOnce(NETWORK_DOWN as never)
      .mockResolvedValueOnce(NETWORK_DOWN as never)
      .mockResolvedValue({ data: 'hello' } as never)
    const { store, api } = setup()

    const request = store.dispatch(api.endpoints.read.initiate())
    await jest.advanceTimersByTimeAsync(10_000)
    const result = await request

    expect(result.data).toBe('hello')
    expect(calls()).toHaveLength(3)
  })

  it('gives up after three more tries', async () => {
    jest.mocked(baseQueryWithRefresh).mockResolvedValue(NETWORK_DOWN as never)
    const { store, api } = setup()

    const request = store.dispatch(api.endpoints.read.initiate())
    await jest.advanceTimersByTimeAsync(60_000)
    const result = await request

    expect(result.isError).toBe(true)
    expect(calls()).toHaveLength(4)
  })

  it('reads again a request that names no method, and one that names it', async () => {
    jest
      .mocked(baseQueryWithRefresh)
      .mockResolvedValueOnce(NETWORK_DOWN as never)
      .mockResolvedValue({ data: 'hello' } as never)
    const { store, api } = setup()

    const first = store.dispatch(api.endpoints.bare.initiate())
    await jest.advanceTimersByTimeAsync(10_000)
    expect((await first).data).toBe('hello')

    jest
      .mocked(baseQueryWithRefresh)
      .mockResolvedValueOnce(NETWORK_DOWN as never)
      .mockResolvedValue({ data: 'again' } as never)
    const second = store.dispatch(api.endpoints.named.initiate())
    await jest.advanceTimersByTimeAsync(10_000)
    expect((await second).data).toBe('again')
  })

  it('does not repeat a request that changes something, nor a refused one', async () => {
    jest.mocked(baseQueryWithRefresh).mockResolvedValue(NETWORK_DOWN as never)
    const { store, api } = setup()

    await store.dispatch(api.endpoints.write.initiate())
    expect(calls()).toHaveLength(1)

    jest.mocked(baseQueryWithRefresh).mockReset()
    jest.mocked(baseQueryWithRefresh).mockResolvedValue({ error: { status: 500, data: 'boom' } } as never)
    await store.dispatch(api.endpoints.read.initiate(undefined, { forceRefetch: true }))
    expect(calls()).toHaveLength(1)
  })
})
