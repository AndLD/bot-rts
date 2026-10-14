import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { buildOpenApiDocument } from '../app.factory'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { API_SCOPES } from '../../../lib/utils/interfaces/api-keys'

// The contract of Phase 8.10: the web client signs in with a session and everyone else with an API key, and both get the same
// API. Whatever a key with enough scopes asks, it gets exactly the answer the session gets.

let database: TestDatabase
let testApp: TestApp
let player: SignedUp
let key: string
let baseId: string
let driveId: string

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  player = await signUpVerified(testApp, database, 'contract@example.com')
  const created = await request(testApp.url)
    .post('/api/v1/api-keys')
    .set(bearer(player.accessToken))
    .send({ name: 'contract', scopes: API_SCOPES, ratePerMinute: 6000 })
    .expect(201)
  key = created.body.secret
  const deployed = await request(testApp.url)
    .post('/api/v1/bots/base')
    .set(bearer(player.accessToken))
    .send({ password: 'secret1' })
    .expect(201)
  baseId = deployed.body.bot._id
  const modules = await request(testApp.url).get(`/api/v1/bots/${baseId}/modules`).set(bearer(player.accessToken))
  driveId = modules.body.find((module: { type: string }) => module.type === 'drive')._id
}, 60000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

interface Answer {
  status: number
  body: unknown
}

async function ask(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  token: string,
  body?: object
): Promise<Answer> {
  const response = await request(testApp.url)[method](path).set(bearer(token)).send(body)
  return { status: response.status, body: response.body }
}

// A path of the document with the ids of this player in place of its parameters; null when a parameter is not known here
function fill(path: string): string | null {
  const ids: Record<string, string> = { id: baseId, botId: baseId, baseId, driveId }
  let known = true
  const result = path.replace(/\{(\w+)\}/g, (_, name: string) => {
    known = known && name in ids
    return ids[name] ?? name
  })
  return known ? result : null
}

// The server's clock appears in a few answers (`now`) and differs between any two calls
const stable = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (key, inner) => (key === 'now' ? undefined : inner)))

// What changes between two calls whoever makes them
const VOLATILE = new Set(['/api/v1/time'])

describe('a key with every scope and a session', () => {
  it('get the same answer from every route that only reads', async () => {
    const document = buildOpenApiDocument(testApp.app)
    const reads = Object.entries(document.paths).flatMap(([path, methods]) => {
      const operation = (methods as Record<string, { 'x-api-key-scope'?: string }>).get
      return operation?.['x-api-key-scope'] === 'read' && !VOLATILE.has(path) ? [path] : []
    })
    const compared: string[] = []

    for (const path of reads) {
      const filled = fill(path)
      if (!filled) continue
      const [asSession, asKey] = [await ask('get', filled, player.accessToken), await ask('get', filled, key)]

      expect(stable({ path, ...asKey })).toEqual(stable({ path, ...asSession }))
      compared.push(path)
    }

    // The routes that were compared include the ones the game screen is built from
    expect(compared).toEqual(
      expect.arrayContaining([
        '/api/v1/bots',
        '/api/v1/users/me',
        '/api/v1/achievements',
        '/api/v1/notifications',
        '/api/v1/map'
      ])
    )
    expect(compared.length).toBeGreaterThan(10)
  })

  it('get the same errors for the same mistakes', async () => {
    const stranger = '99999999-9999-4999-8999-999999999999'
    const cases: Array<[Parameters<typeof ask>[0], string, object?]> = [
      ['get', `/api/v1/bots/${stranger}/modules`],
      ['get', '/api/v1/bots/not-an-id/modules'],
      ['post', '/api/v1/bots/base', { password: 'x' }],
      ['post', `/api/v1/bots/${stranger}/scan`],
      ['put', `/api/v1/bots/${baseId}/drives/${driveId}/file`, { path: '../escape', content: 1 }],
      ['post', `/api/v1/bots/${baseId}/factory/craft`, { module: 'no-such-module' }]
    ]

    for (const [method, path, body] of cases) {
      const [asSession, asKey] = [await ask(method, path, player.accessToken, body), await ask(method, path, key, body)]

      expect({ path, ...asKey }).toEqual({ path, ...asSession })
      expect(asSession.status).toBeGreaterThanOrEqual(400)
    }
  })

  it('refuse the same malformed token in the same way', async () => {
    const [bad, noKey] = [
      await ask('get', '/api/v1/bots', 'not-a-token'),
      await ask('get', '/api/v1/bots', 'botrts_not-a-key')
    ]

    expect(noKey.status).toBe(bad.status)
    expect(Object.keys(noKey.body as object).sort()).toEqual(Object.keys(bad.body as object).sort())
  })
})

describe('on a socket', () => {
  const sockets: Socket[] = []
  afterEach(() => sockets.splice(0).forEach((socket) => socket.close()))

  async function open(token: string) {
    const socket = connect(testApp.url, { auth: { token }, reconnection: false, transports: ['websocket'] })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve())
      socket.on('connect_error', reject)
    })
    return socket
  }
  const ask = (socket: Socket, event: string, ...args: unknown[]) =>
    new Promise<unknown>((resolve) =>
      socket.emit(event, ...args, (result: unknown, error: unknown) => resolve({ result, error }))
    )

  it('a key and a session get the same answers to the same events', async () => {
    const [asSession, asKey] = [await open(player.accessToken), await open(key)]
    const events: Array<[string, ...unknown[]]> = [
      ['get-user-bases'],
      ['get-user-bots'],
      ['get-bot-modules', baseId],
      ['get-factory', baseId],
      ['get-terminal-history', baseId, 10],
      ['get-bot-modules', '99999999-9999-4999-8999-999999999999']
    ]

    for (const [event, ...args] of events) {
      expect(stable({ event, answer: await ask(asKey, event, ...args) })).toEqual(
        stable({ event, answer: await ask(asSession, event, ...args) })
      )
    }
  })
})
