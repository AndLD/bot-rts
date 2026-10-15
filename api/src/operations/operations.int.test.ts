import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'

let database: TestDatabase
let testApp: TestApp
let directory: string
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let alice: SignedUp
let bob: SignedUp
let banned: SignedUp

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const auditOf = (action: string) => database.client.adminAuditEntry.findFirstOrThrow({ where: { action } })
const reboots: string[] = []

beforeAll(async () => {
  database = await createTestDatabase()
  directory = await mkdtemp(join(tmpdir(), 'ops-'))
  const engine = {
    metrics: async () => ({ tick: 5, lastTickMs: 1, p95TickMs: 2, executions: 4, memoryBytes: 10, uptimeMs: 777 }),
    top: async () => [
      { id: 'e1', userId: 'u', botId: 'bot-a', file: '/m', opsUsed: 1, ticks: 1 },
      { id: 'e2', userId: 'u', botId: 'bot-b', file: '/m', opsUsed: 1, ticks: 1 }
    ],
    reboot: async (botId: string) => {
      reboots.push(botId)
      if (botId === 'bot-b') throw new Error('refused')
      return [{}]
    },
    onEvent: () => () => undefined
  }
  const backupFile = join(directory, 'backup.json')
  await writeFile(backupFile, JSON.stringify({ finishedAt: '2026-10-15T03:00:00Z', sizeBytes: 5, location: 's3://x' }))
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000', BACKUP_STATUS_FILE: backupFile }, [
    { provide: ENGINE_PORT, useValue: engine }
  ])
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  alice = await signUpVerified(testApp, database, 'alice-ops@example.com', 'Alice')
  bob = await signUpVerified(testApp, database, 'bob-ops@example.com', 'Bob')
  banned = await signUpVerified(testApp, database, 'banned-ops@example.com', 'Banned')
  await database.client.user.update({ where: { id: banned.userId }, data: { status: 'banned' } })
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
  await rm(directory, { recursive: true, force: true })
})

describe('who may do what', () => {
  it('lets every admin role read the status, and nobody else', async () => {
    for (const who of [owner, admin, moderator, analyst]) {
      await api().get('/api/v1/admin/operations').set(bearer(who)).expect(200)
    }
    await api().get('/api/v1/admin/operations').set(bearer(alice)).expect(403)
    await api().get('/api/v1/admin/operations').expect(401)
  })

  it('keeps announcements and the banner from moderators, and the restart from everyone but an owner', async () => {
    const reason = { reason: 'because' }
    await api()
      .post('/api/v1/admin/operations/announcements')
      .set(bearer(moderator))
      .send({ ...reason, text: 'x' })
      .expect(403)
    await api()
      .put('/api/v1/admin/operations/maintenance-banner')
      .set(bearer(analyst))
      .send({ ...reason, message: 'x', startsAt: 5 })
      .expect(403)
    await api().post('/api/v1/admin/operations/restart-runtime').set(bearer(admin)).send(reason).expect(403)
    expect(reboots).toEqual([])
  })
})

describe('the status', () => {
  it('shows the engine, the control state, the jobs and the backup', async () => {
    await database.client.gameSetting.create({
      data: {
        key: 'job.lifecycle',
        value: { name: 'lifecycle', lastRunAt: 42, failures: 0, totals: { executionsDeleted: 2 } },
        updatedAt: new Date()
      }
    })

    const { body } = await api().get('/api/v1/admin/operations').set(bearer(analyst)).expect(200)

    expect(body).toMatchObject({
      engine: { isResponding: true, uptimeMs: 777, tick: 5, executions: 4 },
      isPaused: false,
      areScriptsHalted: false,
      jobs: [{ name: 'lifecycle', lastRunAt: 42, totals: { executionsDeleted: 2 } }],
      backup: { isConfigured: true, finishedAt: Date.parse('2026-10-15T03:00:00Z'), sizeBytes: 5, location: 's3://x' },
      banner: null
    })
  })
})

describe('announcements', () => {
  it('reach every player who is not banned, as a system notification, and are audited', async () => {
    const answer = await api()
      .post('/api/v1/admin/operations/announcements')
      .set(bearer(admin))
      .send({ text: 'Maintenance at noon', reason: 'planned update' })
      .expect(200)

    expect(answer.body.recipients).toBeGreaterThanOrEqual(6)
    const rows = await database.client.playerNotification.findMany({ where: { kind: 'announcement' } })
    const told = rows.map((row) => row.userId)
    expect(told).toEqual(expect.arrayContaining([alice.userId, bob.userId, owner.userId]))
    expect(told).not.toContain(banned.userId)
    expect(rows[0]).toMatchObject({ category: 'system', params: { text: 'Maintenance at noon' } })
    expect(await auditOf('operations.announce')).toMatchObject({
      reason: 'planned update',
      after: { text: 'Maintenance at noon', recipients: answer.body.recipients }
    })

    const mine = await api().get('/api/v1/notifications').set(bearer(alice)).expect(200)
    expect(mine.body.items[0]).toMatchObject({ kind: 'announcement', params: { text: 'Maintenance at noon' } })
  })

  it('refuse an empty or too long text', async () => {
    const send = (text: string) =>
      api().post('/api/v1/admin/operations/announcements').set(bearer(admin)).send({ text, reason: 'because' })

    await send('').expect(400)
    await send('x'.repeat(501)).expect(400)
  })
})

describe('the stored status of a job', () => {
  it('is written by the job and read back by the console', async () => {
    const { PrismaOperationsStore } = await import('./infrastructure/prisma-operations.store')
    const store = new PrismaOperationsStore(database.client, { now: () => new Date() })

    await store.record({ name: 'other', lastRunAt: 7, failures: 0, totals: {} })
    await store.record({ name: 'other', lastRunAt: 8, failures: 1, totals: { x: 1 } })

    expect(await store.list()).toEqual(
      expect.arrayContaining([{ name: 'other', lastRunAt: 8, failures: 1, totals: { x: 1 } }])
    )
  })
})

describe('the maintenance banner', () => {
  const startsAt = Date.now() + 3_600_000

  it('is set, shown to anyone who asks, and cleared', async () => {
    expect((await api().get('/api/v1/maintenance').expect(200)).body).toEqual({ isPaused: false, banner: null })

    await api()
      .put('/api/v1/admin/operations/maintenance-banner')
      .set(bearer(admin))
      .send({ message: 'Down for an hour', startsAt, endsAt: startsAt + 3_600_000, reason: 'update' })
      .expect(204)

    expect((await api().get('/api/v1/maintenance').expect(200)).body).toEqual({
      isPaused: false,
      banner: { message: 'Down for an hour', startsAt, endsAt: startsAt + 3_600_000 }
    })
    expect(await auditOf('operations.set-banner')).toMatchObject({
      before: null,
      after: { message: 'Down for an hour' }
    })
    expect((await api().get('/api/v1/admin/operations').set(bearer(analyst))).body.banner.message).toBe(
      'Down for an hour'
    )

    await api()
      .delete('/api/v1/admin/operations/maintenance-banner')
      .set(bearer(admin))
      .send({ reason: 'done' })
      .expect(204)
    expect((await api().get('/api/v1/maintenance').expect(200)).body.banner).toBeNull()
    expect(await auditOf('operations.clear-banner')).toMatchObject({ after: null })
  })

  it('can be set without an end', async () => {
    await api()
      .put('/api/v1/admin/operations/maintenance-banner')
      .set(bearer(admin))
      .send({ message: 'Until further notice', startsAt, reason: 'update' })
      .expect(204)

    expect((await api().get('/api/v1/maintenance').expect(200)).body.banner).toEqual({
      message: 'Until further notice',
      startsAt,
      endsAt: null
    })
    await api()
      .delete('/api/v1/admin/operations/maintenance-banner')
      .set(bearer(admin))
      .send({ reason: 'done' })
      .expect(204)
  })

  it('refuses a banner that ends before it starts, or that is empty', async () => {
    const put = (body: object) =>
      api()
        .put('/api/v1/admin/operations/maintenance-banner')
        .set(bearer(admin))
        .send({ reason: 'because', ...body })

    await put({ message: 'x', startsAt, endsAt: startsAt - 1 }).expect(400)
    await put({ message: '', startsAt }).expect(400)
  })

  it('tells visitors the world is paused', async () => {
    await database.client.gameSetting.upsert({
      where: { key: 'engine.control' },
      create: {
        key: 'engine.control',
        value: { isPaused: true, areScriptsHalted: false, quarantined: [] },
        updatedAt: new Date()
      },
      update: { value: { isPaused: true, areScriptsHalted: false, quarantined: [] } }
    })

    expect((await api().get('/api/v1/maintenance').expect(200)).body.isPaused).toBe(true)
  })
})

describe('restarting the scripts', () => {
  it('restarts bot by bot for an owner, counts the ones that refused, and audits it', async () => {
    const { body } = await api()
      .post('/api/v1/admin/operations/restart-runtime')
      .set(bearer(owner))
      .send({ reason: 'the runtime is stuck' })
      .expect(200)

    expect(body).toEqual({ restarted: 1, failedBots: 1 })
    expect(reboots).toEqual(['bot-a', 'bot-b'])
    expect(await auditOf('operations.restart-runtime')).toMatchObject({
      reason: 'the runtime is stuck',
      before: { scripts: 2 },
      after: { restarted: 1, failedBots: 1 }
    })
  })
})
