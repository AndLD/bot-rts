import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import request from 'supertest'
import { ApiClient } from '../../mcp/src/api-client'
import { createServer } from '../../mcp/src/server'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../tests/integration/test-app'

// The MCP server of the mcp/ package against the real API on a seeded database: a player with a base, a key, and an AI that uses the
// key through the tools. The server reaches the game only through HTTP, like any third-party client.

let database: TestDatabase
let testApp: TestApp
let alice: SignedUp
let baseId: string
let driveId: string

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  alice = await signUpVerified(testApp, database, 'ai@example.com', 'The AI')
  const deployed = await request(testApp.url)
    .post('/api/v1/bots/base')
    .set(bearer(alice.accessToken))
    .send({ password: 'secret1' })
  baseId = deployed.body.bot._id
  const drives = await request(testApp.url).get(`/api/v1/bots/${baseId}/drives`).set(bearer(alice.accessToken))
  driveId = drives.body[0]._id
}, 60000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

async function playerWith(scopes: string[]) {
  const created = await request(testApp.url)
    .post('/api/v1/api-keys')
    .set(bearer(alice.accessToken))
    .send({ name: 'ai', scopes })
  const server = createServer(new ApiClient(testApp.url, created.body.secret))
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'ai', version: '1' })
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args })
    const text = (result.content as Array<{ text: string }>)[0].text
    return { isError: result.isError === true, text, json: result.isError ? undefined : JSON.parse(text) }
  }
  return { call, close: () => client.close() }
}

beforeEach(() => database.client.apiKey.deleteMany())

describe('an AI with an API key', () => {
  it('looks at the game: who it is, its base, the modules and drives, the map', async () => {
    const { call, close } = await playerWith(['read'])

    expect((await call('get_me')).json).toMatchObject({ name: 'The AI', email: 'ai@example.com' })
    const bots = (await call('list_bots')).json
    expect(bots).toEqual([expect.objectContaining({ _id: baseId, type: 'base' })])
    expect((await call('get_bot_modules', { botId: baseId })).json.map((m: { type: string }) => m.type)).toContain(
      'drive'
    )
    expect((await call('list_drives', { botId: baseId })).json[0]._id).toBe(driveId)
    expect((await call('list_recipes')).json.length).toBeGreaterThan(0)
    expect((await call('get_game_time')).json.config).toBeDefined()
    expect((await call('get_factory', { baseId })).json).toMatchObject({ jobs: [] })
    expect((await call('get_terminal_history', { botId: baseId, limit: 5 })).json).toEqual([])
    await close()
  })

  it('writes a script file and reads it back, with the files scope', async () => {
    const { call, close } = await playerWith(['read', 'files'])
    const file = { botId: baseId, driveId, path: 'main.js' }

    await call('write_file', { ...file, content: 'export async function main(bot) { bot.log("hi") }' })
    await call('make_directory', { botId: baseId, driveId, path: 'lib' })

    expect((await call('read_file', file)).json).toMatchObject({ content: expect.stringContaining('bot.log') })
    expect((await call('list_files', { botId: baseId, driveId })).json.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining(['main.js', 'lib'])
    )
    await call('delete_file', file)
    expect((await call('read_file', file)).isError).toBe(true)
    await close()
  })

  it('is refused, with a reason it can read, what its key does not allow', async () => {
    const { call, close } = await playerWith(['read'])

    const write = await call('write_file', { botId: baseId, driveId, path: 'x.js', content: '1' })
    const move = await call('bot_move', { botId: baseId, cells: 1 })
    const run = await call('run_script', { botId: baseId, file: '/memory-class1/main.js' })

    for (const refused of [write, move, run]) {
      expect(refused.isError).toBe(true)
      expect(refused.text).toContain('API_KEY_SCOPE')
    }
    expect(move.text).toContain('"movement" scope')
    await close()
  })

  it('reaches the engine through the same rules as anyone: with the engine off the game says it is unavailable', async () => {
    const { call, close } = await playerWith(['read', 'movement', 'scripts'])

    expect((await call('bot_move', { botId: baseId, cells: 1 })).text).toContain('SERVICE_UNAVAILABLE')
    expect((await call('bot_scan', { botId: baseId })).isError).toBe(true)
    expect((await call('run_script', { botId: baseId, file: '/memory-class1/main.js' })).text).toContain(
      'SERVICE_UNAVAILABLE'
    )
    await close()
  })

  it('stops being a player the moment the key is revoked', async () => {
    const created = await request(testApp.url)
      .post('/api/v1/api-keys')
      .set(bearer(alice.accessToken))
      .send({ name: 'gone', scopes: ['read'] })
    const server = createServer(new ApiClient(testApp.url, created.body.secret))
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'ai', version: '1' })
    await Promise.all([server.connect(serverSide), client.connect(clientSide)])
    await request(testApp.url).delete(`/api/v1/api-keys/${created.body._id}`).set(bearer(alice.accessToken)).expect(200)

    const result = await client.callTool({ name: 'get_me', arguments: {} })

    expect(result.isError).toBe(true)
    expect((result.content as Array<{ text: string }>)[0].text).toContain('UNAUTHORIZED')
    await client.close()
  })
})
