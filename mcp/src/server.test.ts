import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { ApiClient, ApiError } from './api-client'
import { createServer, describeFailure } from './server'
import { fakeApi } from './test-support'
import { allTools } from './tools'

// An AI client talking to the server in memory
async function connect(answer?: Parameters<typeof fakeApi>[0]) {
  const api = fakeApi(answer)
  const server = createServer(new ApiClient('https://g', 'botrts_k', api.fetchImpl))
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return { client, api, close: () => client.close() }
}

const textOf = (result: unknown) => (result as { content: Array<{ text: string }> }).content[0]?.text ?? ''

describe('the MCP server', () => {
  it('offers every tool, with its scope in the description and a hint whether it only looks', async () => {
    const { client, close } = await connect()

    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual(allTools.map((tool) => tool.name).sort())
    const scan = tools.find((tool) => tool.name === 'bot_scan')
    expect(scan?.description).toContain('API key scope: read')
    expect(scan?.annotations?.readOnlyHint).toBe(true)
    expect(tools.find((tool) => tool.name === 'bot_move')?.annotations?.readOnlyHint).toBe(false)
    expect(tools.find((tool) => tool.name === 'bot_move')?.inputSchema.required).toEqual(['botId', 'cells'])
    await close()
  })

  it('tells the AI how to start', async () => {
    const { client, close } = await connect()

    expect(client.getInstructions()).toContain('list_bots')
    await close()
  })

  it('calls the API with the key and hands the answer back as JSON text', async () => {
    const { client, api, close } = await connect(() => ({ body: [{ _id: 'b1', type: 'base' }] }))

    const result = await client.callTool({ name: 'list_bots', arguments: {} })

    expect(JSON.parse(textOf(result))).toEqual([{ _id: 'b1', type: 'base' }])
    expect(result.isError).toBeUndefined()
    expect(api.calls[0].headers.Authorization).toBe('Bearer botrts_k')
    await close()
  })

  it('answers null for a call that returns nothing', async () => {
    const { client, close } = await connect(() => ({ status: 204 }))

    expect(textOf(await client.callTool({ name: 'kill_script', arguments: { executionId: 'e' } }))).toBe('null')
    await close()
  })

  it('reports a refusal of the game as a result with its code, and explains a missing scope', async () => {
    const { client, close } = await connect(() => ({
      status: 403,
      body: { statusCode: 403, code: 'API_KEY_SCOPE', error: 'This API key does not have the "movement" scope' }
    }))

    const result = await client.callTool({ name: 'bot_move', arguments: { botId: 'b', cells: 1 } })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('API_KEY_SCOPE: This API key does not have the "movement" scope')
    expect(textOf(result)).toContain('ask the player for a key')
    await close()
  })

  it('refuses input that does not fit the schema before calling the API', async () => {
    const { client, api, close } = await connect()

    const result = await client.callTool({ name: 'bot_turn', arguments: { botId: 'b', direction: 'sideways' } })

    expect(result.isError).toBe(true)
    expect(api.calls).toEqual([])
    await close()
  })
})

describe('describeFailure', () => {
  it('names the code, adds a hint for a rate limit, and handles any other error', () => {
    expect(describeFailure(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests'))).toContain('wait a little')
    expect(describeFailure(new ApiError(404, 'NOT_FOUND', 'Not found'))).toBe('NOT_FOUND: Not found')
    expect(describeFailure(new Error('boom'))).toBe('ERROR: boom')
  })
})
