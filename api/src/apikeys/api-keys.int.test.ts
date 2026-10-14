import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core'
import { METHOD_METADATA } from '@nestjs/common/constants'
import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { IS_PUBLIC_KEY } from '../auth/presentation/public.decorator'
import { REQUIRED_SCOPE_KEY, SESSION_ONLY_KEY } from './presentation/scope.decorator'

let database: TestDatabase
let testApp: TestApp
let alice: SignedUp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  alice = await signUpVerified(testApp, database, 'alice@example.com')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

// Each test makes the keys it needs; a player may hold only a few
beforeEach(() => database.client.apiKey.deleteMany())

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function createKey(body: Record<string, unknown>, who: SignedUp = alice) {
  const response = await request(testApp.url)
    .post('/api/v1/api-keys')
    .set(bearer(who.accessToken))
    .send(body)
    .expect(201)
  return response.body as { _id: string; secret: string; prefix: string; scopes: string[] }
}

describe('managing API keys', () => {
  it('shows the secret once, stores only a hash, and lists the keys without it', async () => {
    const created = await createKey({ name: 'Dashboard', scopes: ['read'] })

    expect(created.secret).toMatch(/^botrts_[\w-]{43}$/)
    expect(created.secret.startsWith(created.prefix)).toBe(true)
    const stored = await database.client.apiKey.findUniqueOrThrow({ where: { id: created._id } })
    expect(stored.keyHash).not.toContain(created.secret)
    expect(JSON.stringify(stored)).not.toContain(created.secret)

    const list = await request(testApp.url).get('/api/v1/api-keys').set(bearer(alice.accessToken)).expect(200)
    expect(JSON.stringify(list.body)).not.toContain(created.secret)
    expect(list.body[0]).toMatchObject({ _id: created._id, name: 'Dashboard', scopes: ['read'], revokedAt: null })
  })

  it('validates the request', async () => {
    const post = (body: unknown) =>
      request(testApp.url)
        .post('/api/v1/api-keys')
        .set(bearer(alice.accessToken))
        .send(body as object)

    await post({ name: 'k', scopes: [] }).expect(400)
    await post({ name: 'k', scopes: ['everything'] }).expect(400)
    await post({ name: '', scopes: ['read'] }).expect(400)
    await post({ name: 'k', scopes: ['read'], ratePerMinute: 100000 }).expect(400)
    await post({ name: 'k', scopes: ['read'], expiresInDays: 0 }).expect(400)
  })

  it('does not show or revoke the keys of another player', async () => {
    const bob = await signUpVerified(testApp, database, 'bob@example.com', 'Bob')
    const key = await createKey({ name: 'bobs', scopes: ['read'] }, bob)

    const list = await request(testApp.url).get('/api/v1/api-keys').set(bearer(alice.accessToken)).expect(200)
    expect(list.body.map((k: { _id: string }) => k._id)).not.toContain(key._id)
    await request(testApp.url).delete(`/api/v1/api-keys/${key._id}`).set(bearer(alice.accessToken)).expect(404)
  })

  it('refuses to manage keys with a key, even one with every scope', async () => {
    const all = await createKey({
      name: 'everything',
      scopes: [
        'read',
        'base',
        'files',
        'scripts',
        'terminal',
        'movement',
        'combat',
        'extraction',
        'logistics',
        'fabrication',
        'maintenance',
        'communication',
        'trade'
      ]
    })
    const asKey = bearer(all.secret)

    for (const call of [
      request(testApp.url).get('/api/v1/api-keys').set(asKey),
      request(testApp.url)
        .post('/api/v1/api-keys')
        .set(asKey)
        .send({ name: 'k', scopes: ['read'] }),
      request(testApp.url).delete(`/api/v1/api-keys/${all._id}`).set(asKey),
      request(testApp.url).patch('/api/v1/settings').set(asKey).send({}),
      request(testApp.url).post('/api/v1/auth/password/change').set(asKey).send({}),
      request(testApp.url).post('/api/v1/auth/account/delete').set(asKey).send({}),
      request(testApp.url).get('/api/v1/users').set(asKey),
      request(testApp.url).get('/api/v1/admin/statistics').set(asKey),
      request(testApp.url).patch('/api/v1/admin/settings').set(asKey).send({})
    ]) {
      const response = await call
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('SESSION_ONLY')
    }
  })
})

describe('using an API key', () => {
  it('acts as its player on the routes of its scopes, and only there', async () => {
    const reader = await createKey({ name: 'reader', scopes: ['read'] })

    await request(testApp.url).get('/api/v1/bots').set(bearer(reader.secret)).expect(200)
    await request(testApp.url).get('/api/v1/users/me').set(bearer(reader.secret)).expect(200)
    const refused = await request(testApp.url)
      .post('/api/v1/bots/base')
      .set(bearer(reader.secret))
      .send({ password: 'secret1' })
      .expect(403)
    expect(refused.body).toMatchObject({ code: 'API_KEY_SCOPE' })

    const builder = await createKey({ name: 'builder', scopes: ['read', 'base'] })
    const deployed = await request(testApp.url)
      .post('/api/v1/bots/base')
      .set(bearer(builder.secret))
      .send({ password: 'secret1' })
      .expect(201)
    // The base belongs to the player, whichever way they come in
    const bots = await request(testApp.url).get('/api/v1/bots').set(bearer(alice.accessToken)).expect(200)
    expect(bots.body.map((bot: { _id: string }) => bot._id)).toContain(deployed.body.bot._id)
  })

  it('finds the scope of a manual action in its category', async () => {
    const base = (await request(testApp.url).get('/api/v1/bots').set(bearer(alice.accessToken))).body[0]._id
    const mover = await createKey({ name: 'mover', scopes: ['movement'] })
    const act = (secret: string, fn: string) =>
      request(testApp.url).post(`/api/v1/bots/${base}/actions`).set(bearer(secret)).send({ fn, args: [] })

    // Movement is allowed through the scope check (the engine is off in this test, so the action itself is unavailable)
    expect((await act(mover.secret, 'move')).status).toBe(503)
    const shot = await act(mover.secret, 'shoot')
    expect(shot.status).toBe(403)
    expect(shot.body.code).toBe('API_KEY_SCOPE')
    // Looking is a read
    expect((await act(mover.secret, 'scan')).status).toBe(403)
    const looker = await createKey({ name: 'looker', scopes: ['read'] })
    expect((await act(looker.secret, 'scan')).status).toBe(503)
  })

  it('can start and stop scripts only with the scripts scope', async () => {
    const base = (await request(testApp.url).get('/api/v1/bots').set(bearer(alice.accessToken))).body[0]._id
    const reader = await createKey({ name: 'r', scopes: ['read'] })
    const runner = await createKey({ name: 'x', scopes: ['scripts'] })
    const file = { file: '/memory-class1/main.js' }

    await request(testApp.url).post(`/api/v1/bots/${base}/executions`).set(bearer(reader.secret)).send(file).expect(403)
    // Through the scope check; the engine is off in this test
    await request(testApp.url).post(`/api/v1/bots/${base}/executions`).set(bearer(runner.secret)).send(file).expect(503)
    await request(testApp.url).delete(`/api/v1/executions/${base}`).set(bearer(reader.secret)).expect(403)
    await request(testApp.url).get('/api/v1/executions').set(bearer(runner.secret)).expect(403)
    await request(testApp.url)
      .post(`/api/v1/bots/${base}/executions`)
      .set(bearer(runner.secret))
      .send({ file: 'relative' })
      .expect(400)
  })

  it('stops working when it is revoked, expires, or is not a key at all', async () => {
    const key = await createKey({ name: 'temporary', scopes: ['read'] })
    await request(testApp.url).get('/api/v1/bots').set(bearer(key.secret)).expect(200)

    await request(testApp.url).delete(`/api/v1/api-keys/${key._id}`).set(bearer(alice.accessToken)).expect(200)
    await request(testApp.url).get('/api/v1/bots').set(bearer(key.secret)).expect(401)

    const expiring = await createKey({ name: 'expiring', scopes: ['read'], expiresInDays: 1 })
    await database.client.apiKey.update({
      where: { id: expiring._id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })
    await request(testApp.url).get('/api/v1/bots').set(bearer(expiring.secret)).expect(401)
    await request(testApp.url).get('/api/v1/bots').set(bearer('botrts_not-a-key')).expect(401)
  })

  it('has its own rate limit, counted per key', async () => {
    const slow = await createKey({ name: 'slow', scopes: ['read'], ratePerMinute: 2 })
    const fast = await createKey({ name: 'fast', scopes: ['read'] })
    const call = (secret: string) => request(testApp.url).get('/api/v1/time').set(bearer(secret))

    await call(slow.secret).expect(200)
    const second = await call(slow.secret).expect(200)
    expect(second.headers['x-ratelimit-remaining']).toBe('0')
    const blocked = await call(slow.secret).expect(429)
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS')
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    await call(fast.secret).expect(200)
    await call(alice.accessToken).expect(200)
  })
})

describe('an API key on a socket', () => {
  let socket: Socket | undefined
  afterEach(() => socket?.close())

  const open = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const opened = connect(testApp.url, { auth: { token }, reconnection: false, transports: ['websocket'] })
      opened.on('connect', () => resolve(opened))
      opened.on('connect_error', reject)
    })
  const ask = (opened: Socket, event: string, ...args: unknown[]) =>
    new Promise<[unknown, { code: number; msg: string } | undefined]>((resolve) =>
      opened.emit(event, ...args, (result: unknown, error?: { code: number; msg: string }) => resolve([result, error]))
    )

  it('connects, and is held to its scopes event by event', async () => {
    const key = await createKey({ name: 'socket', scopes: ['read'], ratePerMinute: 2 })
    socket = await open(key.secret)

    const [bases, error] = await ask(socket, 'get-user-bases')
    expect(error).toBeUndefined()
    expect(Array.isArray(bases)).toBe(true)

    const [, refused] = await ask(socket, 'craft-module', 'x', 'gun', 1)
    expect(refused).toMatchObject({ code: 403 })
    const [, terminal] = await ask(socket, 'open-terminal', 'x')
    expect(terminal).toMatchObject({ code: 403 })
    const [bots] = await ask(socket, 'get-user-bots')
    expect(Array.isArray(bots)).toBe(true)
    const [, limited] = await ask(socket, 'get-user-bots')
    expect(limited).toMatchObject({ code: 429 })
  })

  it('refuses a revoked key at the handshake', async () => {
    const key = await createKey({ name: 'gone', scopes: ['read'] })
    await request(testApp.url).delete(`/api/v1/api-keys/${key._id}`).set(bearer(alice.accessToken)).expect(200)

    await expect(open(key.secret)).rejects.toBeDefined()
  })
})

describe('the routes of the API', () => {
  it('each say what a key may do there: a scope, session only, or public', () => {
    const discovery = new DiscoveryService(testApp.app.get(ModulesContainer))
    const scanner = new MetadataScanner()
    const reflector = testApp.app.get(Reflector)
    const open: string[] = []
    let routes = 0

    for (const wrapper of discovery.getControllers()) {
      const prototype = wrapper.metatype?.prototype
      if (!prototype) continue
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name]
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue
        routes += 1
        const targets = [handler, wrapper.metatype as object]
        const declared = [IS_PUBLIC_KEY, SESSION_ONLY_KEY, REQUIRED_SCOPE_KEY].some(
          (key) => reflector.getAllAndOverride(key, targets as never) !== undefined
        )
        if (!declared) open.push(`${wrapper.metatype?.name}.${name}`)
      }
    }

    expect(routes).toBeGreaterThan(50)
    // A route that names nothing is closed to keys; naming it is a decision, so this list must stay empty
    expect(open).toEqual([])
  })
})
