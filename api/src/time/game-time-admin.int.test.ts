import request from 'supertest'
import { clockTextOf } from '../../../lib/utils/game-time'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000', DEV_TOOLS_ENABLED: 'true' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const post = (who: SignedUp, path: string, body: object = {}) =>
  api()
    .post(`/api/v1/admin/game-time/${path}`)
    .set(bearer(who))
    .send({ reason: 'checked in a test', ...body })
const view = async () => (await api().get('/api/v1/admin/game-time').set(bearer(admin)).expect(200)).body
const textOf = (shown: { now: number; config: Parameters<typeof clockTextOf>[1] }) =>
  clockTextOf(shown.now, shown.config)

describe('the Game time endpoints', () => {
  it('show the clock to the admins who see the dashboard, and let only owners and admins change it', async () => {
    const shown = await api().get('/api/v1/admin/game-time').set(bearer(moderator)).expect(200)
    expect(shown.body).toMatchObject({ canAdvance: true, settings: { mode: 'cycle', offsetMs: 0 } })

    await post(moderator, 'time-of-day', { minuteOfDay: 300 }).expect(403)
    await post(admin, 'time-of-day', { minuteOfDay: 300 }).expect(200)
    await post(owner, 'time-of-day', { minuteOfDay: 990 }).expect(200)
    const player = await signUpVerified(testApp, database, 'game-time-player@example.com')
    await api().get('/api/v1/admin/game-time').set(bearer(player)).expect(403)
  })

  it('set the time of day, change the day length without a jump, and audit each with the reason', async () => {
    const set = await post(admin, 'time-of-day', { minuteOfDay: 5 * 60 }).expect(200)
    expect(textOf(set.body)).toBe('05:00')

    const before = textOf(await view())
    const changed = await post(admin, 'day-length', { dayLengthMs: 6.5 * 3_600_000 }).expect(200)

    expect(textOf(changed.body)).toBe(before)
    expect(changed.body.settings.dayLengthMs).toBe(6.5 * 3_600_000)
    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { action: 'game-time.set-day-length' }
    })
    expect(entry).toMatchObject({ reason: 'checked in a test', actorId: admin.userId, outcome: 'success' })
    expect((entry.before as { dayLengthMs: number }).dayLengthMs).toBe(24 * 60 * 1000)
    expect((entry.after as { dayLengthMs: number }).dayLengthMs).toBe(6.5 * 3_600_000)
    await post(admin, 'day-length', { dayLengthMs: 24 * 60 * 1000 }).expect(200)
  })

  it('show the wall-clock time of a zone and go back to the cycle at the same time of day', async () => {
    const real = await post(admin, 'real-world', { timeZone: 'Europe/Kyiv' }).expect(200)
    expect(real.body.settings).toMatchObject({ mode: 'realWorld', timeZone: 'Europe/Kyiv' })
    const zoneText = textOf(real.body)

    const cycle = await post(admin, 'cycle').expect(200)

    expect(cycle.body.settings.mode).toBe('cycle')
    expect(textOf(cycle.body)).toBe(zoneText)
  })

  it('refuse lengths out of range, unknown zones and times that do not exist', async () => {
    await post(admin, 'day-length', { dayLengthMs: 1000 }).expect(400)
    await post(admin, 'day-length', { dayLengthMs: 25 * 3_600_000 }).expect(400)
    await post(admin, 'real-world', { timeZone: 'Mars/Olympus' }).expect(400)
    await post(admin, 'time-of-day', { minuteOfDay: 1440 }).expect(400)
    await api().post('/api/v1/admin/game-time/time-of-day').set(bearer(admin)).send({ minuteOfDay: 10 }).expect(400)
  })
})

describe('advancing the clock, a tool of a test server', () => {
  const advance = (who: SignedUp, stepMs: number) =>
    api()
      .post('/api/v1/admin/devtools/advance-clock')
      .set(bearer(who))
      .send({ stepMs, reason: 'finish the craft without waiting' })

  it('is for owners, moves the game time forward by the step, and leaves sessions alone', async () => {
    const before = (await view()).now

    const moved = await advance(owner, 3_600_000).expect(200)

    expect(moved.body.now - before).toBeGreaterThanOrEqual(3_600_000)
    expect(moved.body.settings.offsetMs).toBe(3_600_000)
    await advance(admin, 60_000).expect(403)
    await api().get('/api/v1/admin/me').set(bearer(owner)).expect(200)
    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { action: 'devtools.advance-clock' }
    })
    expect(entry).toMatchObject({ reason: 'finish the craft without waiting', actorId: owner.userId })
  })

  it('refuses a step that is not offered, and one that goes back', async () => {
    await advance(owner, 5).expect(400)
    await advance(owner, -3_600_000).expect(400)
  })
})
