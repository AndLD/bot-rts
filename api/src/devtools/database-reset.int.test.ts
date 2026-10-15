import request from 'supertest'
import { DEFAULT_GAME_TIME_SETTINGS } from '../../../lib/utils/game-time'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { GameTimeSettingsService } from '../time/application/game-time-settings.service'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let otherOwner: SignedUp
let admin: SignedUp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000', DEV_TOOLS_ENABLED: 'true' })
  owner = await signUpAdmin(testApp, database, 'owner')
  otherOwner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
}, 60000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = (app: TestApp = testApp) => request(app.url)
const reset = (who: SignedUp, body: object = { confirmation: 'RESET', reason: 'a clean slate for the next run' }) =>
  api().post('/api/v1/admin/devtools/reset-database').set(bearer(who)).send(body)

describe('the reset of the database of a test server', () => {
  it('is for owners, needs the typed word and a reason, and is audited', async () => {
    await reset(admin).expect(403)
    expect((await reset(owner, { confirmation: 'reset', reason: 'wrong case' }).expect(400)).body.error).toContain(
      'RESET'
    )
    await reset(owner, { confirmation: 'RESET' }).expect(400)
  })

  it('empties the world, keeps the owners and the one who pressed, ends the other logins and puts the clock back', async () => {
    const player = await signUpVerified(testApp, database, 'to-be-erased@example.com')
    await api()
      .post('/api/v1/bots/base')
      .set(bearer(player))
      .send({ password: 'secret1' })
      .catch(() => undefined)
    await api()
      .post('/api/v1/admin/devtools/seed-world')
      .set(bearer(owner))
      .send({ count: 2, reason: 'something to erase' })
      .expect(200)
    const gameTime = testApp.app.get(GameTimeSettingsService)
    await gameTime.update({ ...DEFAULT_GAME_TIME_SETTINGS, offsetMs: 3_600_000 })
    const migrations = await database.client.$queryRaw<[{ count: bigint }]>`SELECT count(*) FROM _prisma_migrations`
    const audits = await database.client.adminAuditEntry.count()
    expect(await database.client.bot.count()).toBeGreaterThan(0)

    const result = await reset(owner).expect(200)

    expect(result.body.tablesEmptied).toBeGreaterThan(10)
    expect(result.body.accountsErased).toBeGreaterThanOrEqual(3)
    expect(await database.client.bot.count()).toBe(0)
    expect(await database.client.module.count()).toBe(0)
    expect(await database.client.mapPoint.count()).toBe(0)
    // The owners stay, and nobody else
    const users = await database.client.user.findMany({ select: { id: true, status: true } })
    expect(users.map(({ id }) => id).sort()).toEqual([owner.userId, otherOwner.userId].sort())
    // The one who pressed the button is still signed in, with the second factor; every other login has ended
    await api().get('/api/v1/admin/me').set(bearer(owner)).expect(200)
    await api().get('/api/v1/users/me').set(bearer(otherOwner)).expect(401)
    await api().get('/api/v1/users/me').set(bearer(player)).expect(401)
    // The migrations and the audit trail are untouched (and the reset itself is on the trail)
    expect(
      (await database.client.$queryRaw<[{ count: bigint }]>`SELECT count(*) FROM _prisma_migrations`)[0].count
    ).toBe(migrations[0].count)
    expect(await database.client.adminAuditEntry.count()).toBeGreaterThan(audits)
    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { action: 'devtools.reset-database', outcome: 'success' }
    })
    expect(entry).toMatchObject({ reason: 'a clean slate for the next run', actorId: owner.userId, outcome: 'success' })
    // The game clock is back to real time, here and in the store
    expect(gameTime.current().offsetMs).toBe(0)
    expect((await api().get('/api/v1/admin/game-time').set(bearer(owner)).expect(200)).body.settings.offsetMs).toBe(0)
  })

  it('leaves a server that can sign in and play again', async () => {
    const fresh = await signUpVerified(testApp, database, 'after-the-reset@example.com')

    await api().get('/api/v1/users/me').set(bearer(fresh)).expect(200)
  })
})

describe('the reset with the engine running', () => {
  let withEngine: TestApp
  let engineOwner: SignedUp

  beforeAll(async () => {
    withEngine = await startTestApp(database, {
      RATE_LIMIT_API_MAX: '100000',
      DEV_TOOLS_ENABLED: 'true',
      ENGINE_ENABLED: 'true',
      ENGINE_TICK_INTERVAL_MS: '20'
    })
    engineOwner = await signUpAdmin(withEngine, database, 'owner')
  }, 90000)
  afterAll(async () => {
    await withEngine.close()
  })

  it('stops the engine, empties the world and starts the engine on the empty world, which then serves a new player', async () => {
    const before = await signUpVerified(withEngine, database, 'engine-before@example.com')
    await api(withEngine).post('/api/v1/bots/base').set(bearer(before)).send({ password: 'secret1' }).expect(201)
    expect(await database.client.bot.count()).toBeGreaterThan(0)

    await api(withEngine)
      .post('/api/v1/admin/devtools/reset-database')
      .set(bearer(engineOwner))
      .send({ confirmation: 'RESET', reason: 'with the engine' })
      .expect(200)

    expect(await database.client.bot.count()).toBe(0)
    const after = await signUpVerified(withEngine, database, 'engine-after@example.com')
    const deployed = await api(withEngine)
      .post('/api/v1/bots/base')
      .set(bearer(after))
      .send({ password: 'secret1' })
      .expect(201)
    expect(deployed.body.bot._id).toEqual(expect.any(String))
    await api(withEngine).post(`/api/v1/bots/${deployed.body.bot._id}/scan`).set(bearer(after)).expect(200)
  }, 120000)
})
