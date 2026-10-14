import { EventEmitter } from 'node:events'
import { loadConfig } from './config'
import { start } from './start'
import { fakeApi } from './test-support'

const stdio = { connected: 0 }
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class extends EventEmitter {
    onmessage?: unknown
    onclose?: () => void
    async start() {
      stdio.connected += 1
    }
    async send() {}
    async close() {
      this.onclose?.()
    }
  }
}))

describe('start', () => {
  it('serves over stdio with the key of the environment', async () => {
    const running = await start(loadConfig({ BOTRTS_API_KEY: 'botrts_k' }), fakeApi().fetchImpl)

    expect(running.address).toBeNull()
    expect(stdio.connected).toBe(1)
    await running.stop()
  })

  it('listens on a port for HTTP and stops on request', async () => {
    const running = await start(loadConfig({ MCP_TRANSPORT: 'http', MCP_PORT: '0' }), fakeApi().fetchImpl)

    expect(running.address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/)
    const health = await fetch((running.address as string).replace('/mcp', '/health'))
    expect(health.status).toBe(200)
    await running.stop()
  })
})
