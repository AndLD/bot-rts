import { ApiClient, ApiError } from './api-client'
import { fakeApi } from './test-support'

const URL_ = 'https://play.example'

describe('ApiClient', () => {
  it('uses the fetch of the platform unless told otherwise', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}'))

    await expect(new ApiClient(URL_, 'k').get('/x')).resolves.toEqual({ ok: true })

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('sends the key as a bearer token to /api/v1, with the query and without a body for a read', async () => {
    const { calls, fetchImpl } = fakeApi(() => ({ body: [{ id: 1 }] }))

    const result = await new ApiClient(URL_, 'botrts_k', fetchImpl).get('/bots', {
      type: 'base',
      limit: 5,
      skipped: undefined
    })

    expect(result).toEqual([{ id: 1 }])
    expect(calls).toEqual([
      {
        method: 'GET',
        url: 'https://play.example/api/v1/bots?type=base&limit=5',
        headers: { Authorization: 'Bearer botrts_k' },
        body: undefined
      }
    ])
  })

  it('sends a JSON body for POST and PUT, and a query for DELETE', async () => {
    const { calls, fetchImpl } = fakeApi()
    const client = new ApiClient(URL_, 'botrts_k', fetchImpl)

    await client.post('/a', { x: 1 })
    await client.put('/b', { y: 2 })
    await client.delete('/c', { path: 'main.js' })
    await client.post('/d')

    expect(calls.map((call) => [call.method, call.url.replace(URL_, ''), call.body])).toEqual([
      ['POST', '/api/v1/a', { x: 1 }],
      ['PUT', '/api/v1/b', { y: 2 }],
      ['DELETE', '/api/v1/c?path=main.js', undefined],
      ['POST', '/api/v1/d', undefined]
    ])
    expect(calls[0].headers['Content-Type']).toBe('application/json')
    expect(calls[2].headers['Content-Type']).toBeUndefined()
  })

  it('answers undefined for an empty body and the text for one that is not JSON', async () => {
    const empty = new ApiClient(URL_, 'k', fakeApi(() => ({ status: 204 })).fetchImpl)
    const plain = new ApiClient(URL_, 'k', fakeApi(() => ({ body: 'not json' })).fetchImpl)

    await expect(empty.get('/x')).resolves.toBeUndefined()
    await expect(plain.get('/x')).resolves.toBe('not json')
  })

  it('turns an error answer into an ApiError with the code of the game', async () => {
    const { fetchImpl } = fakeApi(() => ({
      status: 403,
      body: { statusCode: 403, code: 'API_KEY_SCOPE', error: 'No files scope' }
    }))

    await expect(new ApiClient(URL_, 'k', fetchImpl).get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'API_KEY_SCOPE',
      message: 'No files scope'
    })
  })

  it('still makes an ApiError of an error that has no body of the game', async () => {
    const { fetchImpl } = fakeApi(() => ({ status: 502, body: '<html>bad gateway</html>' }))

    await expect(new ApiClient(URL_, 'k', fetchImpl).get('/x')).rejects.toMatchObject({ status: 502, code: 'HTTP_502' })
  })

  it('makes an ApiError of an error answer with no body at all', async () => {
    const { fetchImpl } = fakeApi(() => ({ status: 500 }))

    await expect(new ApiClient(URL_, 'k', fetchImpl).get('/x')).rejects.toMatchObject({ status: 500, code: 'HTTP_500' })
  })

  it('says when the game cannot be reached', async () => {
    const down = new ApiClient(URL_, 'k', async () => {
      throw new Error('ECONNREFUSED')
    })

    await expect(down.get('/x')).rejects.toBeInstanceOf(ApiError)
    await expect(down.get('/x')).rejects.toMatchObject({
      code: 'UNREACHABLE',
      message: expect.stringContaining('ECONNREFUSED')
    })
  })
})
