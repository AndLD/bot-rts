import { randomUUID } from 'crypto'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { urlForDatabase } from '../../tests/integration/database-url'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { loadConfig } from '../config/app-config'
import { withActiveBalance } from './infrastructure/boot-balance'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let player: SignedUp

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const auditOf = (action: string, targetId: string) =>
  database.client.adminAuditEntry.findFirstOrThrow({ where: { action, targetId } })
const faster = { recipes: { 'gun-class1': { craftTimeMs: 1 } } }

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  player = await signUpVerified(testApp, database, 'player-bal@example.com', 'Player')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('who may see and change the balance', () => {
  it('lets an analyst read the economy and the balance but not change it', async () => {
    await api().get('/api/v1/admin/economy').set(bearer(analyst)).expect(200)
    await api().get('/api/v1/admin/balance').set(bearer(analyst)).expect(200)
    await api().post('/api/v1/admin/balance/preview').set(bearer(analyst)).send({ document: {} }).expect(403)
    await api().post('/api/v1/admin/balance').set(bearer(analyst)).send({ document: {}, reason: 'x' }).expect(403)
  })

  it('keeps a moderator and a player out', async () => {
    await api().get('/api/v1/admin/economy').set(bearer(moderator)).expect(403)
    await api().get('/api/v1/admin/balance').set(bearer(player)).expect(403)
  })
})

describe('the economy', () => {
  it('counts deposits, what is carried, blueprints and modules', async () => {
    const baseId = randomUUID()
    await database.client.bot.create({
      data: { id: baseId, type: 'base', userId: player.userId, passwordHash: 'x', heading: 0 }
    })
    await database.client.mapPoint.createMany({
      data: [
        { id: randomUUID(), x: 1, y: 1, type: 'resource', resource: 'iron', amount: 100 },
        { id: randomUUID(), x: 3, y: 1, type: 'base', contentId: baseId }
      ]
    })
    await database.client.module.create({
      data: {
        id: randomUUID(),
        botId: baseId,
        type: 'storage',
        name: 'storage-class1',
        condition: 1,
        maxCondition: 1,
        weight: 1,
        operationCost: 0,
        idleCost: 0,
        props: { items: [{ resource: 'iron', amount: 12.5 }] }
      }
    })
    await database.client.module.create({
      data: {
        id: randomUUID(),
        botId: baseId,
        type: 'storage',
        name: 'storage-class1',
        condition: 1,
        maxCondition: 1,
        weight: 1,
        operationCost: 0,
        idleCost: 0,
        props: {}
      }
    })
    await database.client.blueprint.create({
      data: { userId: player.userId, module: 'gun-class2', source: 'research', learnedAt: new Date() }
    })

    const { body } = await api().get('/api/v1/admin/economy').set(bearer(analyst)).expect(200)

    expect(body.resources.find((stat: { resource: string }) => stat.resource === 'iron')).toMatchObject({
      deposits: 1,
      remaining: 100,
      stored: 12.5
    })
    expect(body.blueprints).toEqual([{ module: 'gun-class2', research: 1, item: 0 }])
    expect(body.modules).toEqual([{ type: 'storage', name: 'storage-class1', count: 2 }])
  })
})

describe('the balance', () => {
  it('starts on the defaults', async () => {
    const { body } = await api().get('/api/v1/admin/balance').set(bearer(analyst)).expect(200)

    expect(body).toMatchObject({ activeVersion: null, runningVersion: null, problem: null, documentJson: '{}' })
    expect(body.effective.length).toBeGreaterThan(10)
  })

  it('previews a document without storing it, and lists the problems of a bad one', async () => {
    const preview = await api().post('/api/v1/admin/balance/preview').set(bearer(admin)).send({ document: faster })
    expect(preview.status).toBe(200)
    expect(preview.body.changes).toEqual([{ path: 'recipes.gun-class1.craftTimeMs', from: '20000', to: '1' }])

    const bad = await api()
      .post('/api/v1/admin/balance/preview')
      .set(bearer(admin))
      .send({ document: { x: {} } })
    expect(bad.body).toEqual({ problems: ['x: unknown section'], changes: [] })
    expect(await database.client.balanceVersion.count()).toBe(0)
  })

  it('refuses to store a bad document, and a save without a reason', async () => {
    await api()
      .post('/api/v1/admin/balance')
      .set(bearer(admin))
      .send({ document: { resources: { iron: { minAmount: 9_999_999 } } }, reason: 'oops' })
      .expect(400)
    await api().post('/api/v1/admin/balance').set(bearer(admin)).send({ document: faster }).expect(400)
    expect(await database.client.balanceVersion.count()).toBe(0)
  })

  it('stores versions, makes the newest active and audits the change', async () => {
    await api()
      .post('/api/v1/admin/balance')
      .set(bearer(admin))
      .send({ document: faster, reason: 'quick guns' })
      .expect(204)
    await api().post('/api/v1/admin/balance').set(bearer(owner)).send({ document: {}, reason: 'back' }).expect(204)

    const { body } = await api().get('/api/v1/admin/balance').set(bearer(analyst)).expect(200)
    expect(body.activeVersion).toBe(2)
    expect(
      body.versions.map((version: { version: number; isActive: boolean }) => [version.version, version.isActive])
    ).toEqual([
      [2, true],
      [1, false]
    ])
    const entry = await auditOf('balance.save', '1')
    expect(entry).toMatchObject({ targetType: 'balance', reason: 'quick guns', before: { version: null } })
    expect(entry.after).toMatchObject({ version: 1 })
  })

  it('shows the document of a version, and does not know one that was never stored', async () => {
    const { body } = await api().get('/api/v1/admin/balance/versions/1').set(bearer(analyst)).expect(200)
    expect(JSON.parse(body.documentJson)).toEqual(faster)

    await api().get('/api/v1/admin/balance/versions/99').set(bearer(analyst)).expect(404)
    await api().get('/api/v1/admin/balance/versions/abc').set(bearer(analyst)).expect(400)
  })

  it('rolls back as a new version, with the reason in the audit trail', async () => {
    await api()
      .post('/api/v1/admin/balance/versions/1/rollback')
      .set(bearer(admin))
      .send({ reason: 'the old numbers' })
      .expect(204)

    const state = (await api().get('/api/v1/admin/balance').set(bearer(analyst)).expect(200)).body
    expect(state.activeVersion).toBe(3)
    expect(JSON.parse(state.documentJson)).toEqual(faster)
    expect(await auditOf('balance.rollback', '1')).toMatchObject({ reason: 'the old numbers' })
    await api()
      .post('/api/v1/admin/balance/versions/99/rollback')
      .set(bearer(admin))
      .send({ reason: 'no such version' })
      .expect(404)
  })
})

describe('the balance at the start of a process', () => {
  async function bootConfig() {
    const [{ db }] = await database.client.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`
    return loadConfig({ DATABASE_URL: urlForDatabase(db), NODE_ENV: 'test' })
  }
  const activate = (version: number) =>
    database.client.gameSetting.update({ where: { key: 'balance.active' }, data: { value: { version } } })

  it('lays the active version over the configuration', async () => {
    const config = await bootConfig()

    const booted = await withActiveBalance(config)

    expect(booted.balance).toMatchObject({ version: 3, problem: null })
    expect(booted.crafting.recipes.find((recipe) => recipe.module === 'gun-class1')?.craftTimeMs).toBe(1)
    expect(config.crafting.recipes.find((recipe) => recipe.module === 'gun-class1')?.craftTimeMs).not.toBe(1)
  })

  it('keeps the configuration when no version is active, or the active one is gone', async () => {
    const config = await bootConfig()

    await activate(99)
    expect(await withActiveBalance(config)).toEqual(config)

    await database.client.gameSetting.delete({ where: { key: 'balance.active' } })
    expect(await withActiveBalance(config)).toEqual(config)
  })

  it('does not use a stored version that no longer passes the checks, and says why', async () => {
    await database.client.balanceVersion.create({
      data: {
        version: 50,
        document: { resources: { iron: { minAmount: 9_999_999 } } },
        reason: 'hand edit',
        createdBy: owner.userId,
        createdAt: new Date()
      }
    })
    await database.client.gameSetting.create({
      data: { key: 'balance.active', value: { version: 50 }, updatedAt: new Date() }
    })
    const config = await bootConfig()

    const booted = await withActiveBalance(config)

    expect(booted.world).toEqual(config.world)
    expect(booted.balance.problem).toBe('Version 50: iron: minAmount must not exceed maxAmount')
    expect(booted.balance.version).toBeNull()
  })
})
