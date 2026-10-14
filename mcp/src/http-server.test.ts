import { AddressInfo } from 'node:net'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from 'node:http'
import { McpConfig } from './config'
import { createMcpHttpServer } from './http-server'
import { fakeApi } from './test-support'

const config = (apiKey?: string): McpConfig => ({
  apiUrl: 'https://g',
  apiKey,
  transport: 'http',
  http: { host: '127.0.0.1', port: 0 }
})

let server: Server | undefined
afterEach(
  () =>
    new Promise<void>((resolve) => {
      server?.closeAllConnections()
      server ? server.close(() => resolve()) : resolve()
    })
)

async function listen(apiKey?: string, answer?: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi(answer)
  server = createMcpHttpServer(config(apiKey), api.fetchImpl)
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { api, url }
}

const post = (url: string, init: RequestInit & { token?: string } = {}) =>
  fetch(`${url}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {})
    },
    body: init.body ?? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  })

describe('the MCP server over HTTP', () => {
  it('serves an MCP client that brings its own key, and calls the game with that key', async () => {
    const { api, url } = await listen(undefined, () => ({ body: { name: 'Alice' } }))
    const client = new Client({ name: 'test', version: '1' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
        requestInit: { headers: { Authorization: 'Bearer botrts_mine' } }
      })
    )

    const tools = await client.listTools()
    const me = await client.callTool({ name: 'get_me', arguments: {} })

    expect(tools.tools.length).toBeGreaterThan(30)
    expect(JSON.parse((me.content as Array<{ text: string }>)[0].text)).toEqual({ name: 'Alice' })
    expect(api.calls[0].headers.Authorization).toBe('Bearer botrts_mine')
    await client.close()
  })

  it('falls back to the key the server was started with', async () => {
    const { api, url } = await listen('botrts_default')
    const client = new Client({ name: 'test', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)))

    await client.callTool({ name: 'get_me', arguments: {} })

    expect(api.calls[0].headers.Authorization).toBe('Bearer botrts_default')
    await client.close()
  })

  it('wants a key, from the header or from the start', async () => {
    const { url } = await listen()

    const response = await post(url)

    expect(response.status).toBe(401)
    expect((await response.json()).error.message).toContain('API key')
  })

  it('refuses what is not a POST to /mcp', async () => {
    const { url } = await listen('botrts_k')

    const get = await fetch(`${url}/mcp`)
    expect(get.status).toBe(405)
    expect(get.headers.get('allow')).toBe('POST')
    expect((await fetch(`${url}/elsewhere`)).status).toBe(404)
  })

  it('answers the health check without a key', async () => {
    const { url } = await listen()

    const response = await fetch(`${url}/health`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('refuses a body that is not JSON or is too large', async () => {
    const { url } = await listen('botrts_k')

    expect((await post(url, { body: '{not json' })).status).toBe(400)
    expect((await post(url, { body: JSON.stringify({ filler: 'x'.repeat(2 * 1024 * 1024) }) })).status).toBe(413)
  })

  it('treats a request with a bearer that is not a key the same as any other, leaving the decision to the game', async () => {
    const { api, url } = await listen(undefined, () => ({
      status: 401,
      body: { statusCode: 401, code: 'UNAUTHORIZED', error: 'x' }
    }))
    const client = new Client({ name: 'test', version: '1' })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
        requestInit: { headers: { Authorization: 'Bearer wrong' } }
      })
    )

    const result = await client.callTool({ name: 'get_me', arguments: {} })

    expect(result.isError).toBe(true)
    expect((result.content as Array<{ text: string }>)[0].text).toContain('UNAUTHORIZED')
    expect(api.calls).toHaveLength(1)
    await client.close()
  })

  it('accepts a request without a body as an empty message', async () => {
    const { url } = await listen('botrts_k')

    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
