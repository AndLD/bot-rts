import { randomUUID } from 'crypto'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let alice: SignedUp
let bob: SignedUp
let carol: SignedUp
let aliceKey: { _id: string; secret: string }

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const usage = { id: 'e1', userId: 'u1', botId: 'b1', file: '/m/a.js', opsUsed: 99, ticks: 12 }

beforeAll(async () => {
  database = await createTestDatabase()
  const engine = { top: async () => [usage], onEvent: () => () => undefined, metrics: async () => ({}) }
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' }, [{ provide: ENGINE_PORT, useValue: engine }])
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  alice = await signUpVerified(testApp, database, 'alice-sec@example.com', 'Alice')
  bob = await signUpVerified(testApp, database, 'bob-sec@example.com', 'Bob')
  carol = await signUpVerified(testApp, database, 'carol-sec@example.com', 'Carol')

  for (let i = 0; i < 6; i += 1) {
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'victim-sec@example.com', password: 'wrong-password' })
      .expect(401)
  }
  const created = await api()
    .post('/api/v1/api-keys')
    .set(bearer(alice))
    .send({ name: 'Throttled', scopes: ['read'], ratePerMinute: 1 })
    .expect(201)
  aliceKey = created.body
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('the sign-in attempts', () => {
  it('are written down with their outcome, address and agent', async () => {
    const attempts = await database.client.loginAttempt.findMany({ where: { email: 'victim-sec@example.com' } })

    expect(attempts).toHaveLength(6)
    expect(attempts[0]).toMatchObject({ outcome: 'bad_credentials', userId: null, ip: expect.any(String) })
    const success = await database.client.loginAttempt.findFirstOrThrow({
      where: { email: 'alice-sec@example.com', outcome: 'success' }
    })
    expect(success.userId).toBe(alice.userId)
  })

  it('are removed by the data lifecycle once old', async () => {
    const old = randomUUID()
    await database.client.loginAttempt.create({
      data: { id: old, at: new Date('2020-01-01T00:00:00Z'), email: 'old@example.com', outcome: 'success' }
    })

    const { PrismaLifecycleRepository } = await import('../lifecycle/infrastructure/prisma-lifecycle.repository')
    await new PrismaLifecycleRepository(database.client).deleteExpiredAuthData(new Date('2021-01-01T00:00:00Z'))

    expect(await database.client.loginAttempt.findUnique({ where: { id: old } })).toBeNull()
  })
})

describe('the overview', () => {
  it('shows failed sign-ins by address and by email, and accounts that share an address', async () => {
    const overview = await api().get('/api/v1/admin/security?hours=24').set(bearer(moderator)).expect(200)

    expect(overview.body.hours).toBe(24)
    expect(overview.body.failedLoginsByEmail[0]).toMatchObject({ key: 'victim-sec@example.com', failures: 6 })
    expect(overview.body.failedLoginsByIp[0]).toMatchObject({
      failures: expect.any(Number),
      distinctEmails: expect.any(Number)
    })
    // Every test account signs in from this machine
    const group = overview.body.sameIpAccounts[0]
    expect(group.accounts.map((account: { name: string }) => account.name)).toEqual(
      expect.arrayContaining(['Alice', 'Bob', 'Carol'])
    )
    expect(overview.body.topConsumers).toEqual([
      { executionId: 'e1', userId: 'u1', botId: 'b1', file: '/m/a.js', opsUsed: 99, ticks: 12 }
    ])
  })

  it('shows accounts that signed in from many addresses', async () => {
    for (const ip of ['9.9.9.1', '9.9.9.2', '9.9.9.3']) {
      await database.client.loginAttempt.create({
        data: {
          id: randomUUID(),
          at: new Date(),
          email: 'carol-sec@example.com',
          userId: carol.userId,
          ip,
          outcome: 'success'
        }
      })
    }

    const overview = await api().get('/api/v1/admin/security').set(bearer(admin)).expect(200)

    expect(overview.body.multiIpAccounts).toEqual([
      expect.objectContaining({ _id: carol.userId, name: 'Carol', ips: expect.any(Number) })
    ])
  })

  it('shows locked bots with their owner', async () => {
    const botId = randomUUID()
    await database.client.bot.create({
      data: { id: botId, type: 'base', userId: bob.userId, passwordHash: 'x', heading: 0, label: 'Fort' }
    })
    await database.client.botAccess.create({
      data: { botId, failures: 5, lockedUntil: new Date(Date.now() + 3_600_000) }
    })

    const worker = randomUUID()
    await database.client.bot.create({
      data: { id: worker, type: 'worker', baseId: botId, passwordHash: 'x', heading: 0 }
    })
    await database.client.botAccess.create({
      data: { botId: worker, failures: 6, lockedUntil: new Date(Date.now() + 1_800_000) }
    })

    const overview = await api().get('/api/v1/admin/security').set(bearer(moderator)).expect(200)

    expect(overview.body.botLockouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ botId, label: 'Fort', ownerId: bob.userId, ownerName: 'Bob', failures: 5 }),
        expect.objectContaining({ botId: worker, ownerId: bob.userId, ownerName: 'Bob', failures: 6 })
      ])
    )
  })

  it('shows scripts the sandbox stopped, and not the ones that failed by themselves', async () => {
    const botId = randomUUID()
    await database.client.bot.create({
      data: { id: botId, type: 'base', userId: alice.userId, passwordHash: 'x', heading: 0 }
    })
    const execution = (reason: string) =>
      database.client.execution.create({
        data: {
          id: randomUUID(),
          botId,
          userId: alice.userId,
          file: '/m/a.js',
          args: [],
          status: 'killed',
          reason,
          createdAt: new Date(Date.now() - 2000),
          endedAt: new Date(Date.now() - 1000)
        }
      })
    const stopped = await execution('TIME_LIMIT: the slice of a tick was exceeded')
    await execution('SCRIPT_ERROR: boom')
    await execution('killed')

    const overview = await api().get('/api/v1/admin/security').set(bearer(moderator)).expect(200)

    expect(overview.body.suspiciousScripts).toEqual([
      expect.objectContaining({
        executionId: stopped.id,
        code: 'TIME_LIMIT',
        owner: { _id: alice.userId, name: 'Alice' },
        botId
      })
    ])
  })

  it('shows API keys with their use and the times their limit held them back', async () => {
    const call = () =>
      api()
        .get('/api/v1/users/me')
        .set({ Authorization: `Bearer ${aliceKey.secret}` })
    await call().expect(200)
    await call().expect(429)
    await call().expect(429)

    const overview = await api().get('/api/v1/admin/security').set(bearer(moderator)).expect(200)

    expect(overview.body.apiKeys[0]).toMatchObject({
      _id: aliceKey._id,
      name: 'Throttled',
      owner: { _id: alice.userId, name: 'Alice' },
      scopes: ['read'],
      ratePerMinute: 1,
      isRevoked: false,
      rateLimitHits: 2
    })
  })

  it('validates the window and is for roles with security.read', async () => {
    await api().get('/api/v1/admin/security?hours=5').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/security').set(bearer(analyst)).expect(403)
    await api().get('/api/v1/admin/security').set(bearer(alice)).expect(403)
  })
})

describe('revoking a key', () => {
  it('ends the key at once, audits it, and is for admins', async () => {
    await api()
      .post(`/api/v1/admin/security/api-keys/${aliceKey._id}/revoke`)
      .set(bearer(moderator))
      .send({ reason: 'abusing it' })
      .expect(403)
    await api().post(`/api/v1/admin/security/api-keys/${aliceKey._id}/revoke`).set(bearer(admin)).send({}).expect(400)
    await api()
      .post(`/api/v1/admin/security/api-keys/${aliceKey._id}/revoke`)
      .set(bearer(admin))
      .send({ reason: 'abusing it' })
      .expect(204)

    await api()
      .get('/api/v1/users/me')
      .set({ Authorization: `Bearer ${aliceKey.secret}` })
      .expect(401)
    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { actorId: admin.userId, action: 'security.revoke-key', outcome: 'success' }
    })
    expect(entry).toMatchObject({
      targetType: 'api-key',
      targetId: aliceKey._id,
      reason: 'abusing it',
      after: { revoked: true }
    })
    await api()
      .post(`/api/v1/admin/security/api-keys/${aliceKey._id}/revoke`)
      .set(bearer(owner))
      .send({ reason: 'again, harmlessly' })
      .expect(204)
    await api()
      .post(`/api/v1/admin/security/api-keys/${randomUUID()}/revoke`)
      .set(bearer(admin))
      .send({ reason: 'no such key' })
      .expect(404)
    await api()
      .post('/api/v1/admin/security/api-keys/nope/revoke')
      .set(bearer(admin))
      .send({ reason: 'bad id here' })
      .expect(400)
  })
})
