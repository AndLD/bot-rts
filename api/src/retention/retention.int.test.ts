import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { LIFECYCLE_SERVICE } from '../lifecycle/lifecycle.module'
import { LifecycleService } from '../lifecycle/application/lifecycle.service'

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let moderator: SignedUp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const patch = (jobs: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  api()
    .patch('/api/v1/admin/retention')
    .set(bearer(admin))
    .send({ jobs, reason: 'tuning', ...extra })
interface JobView {
  job: string
  values: Record<string, unknown>
  isOverridden: boolean
  lastRemoved: number | null
}
const job = (body: { jobs: JobView[] }, name: string) => body.jobs.find((entry) => entry.job === name) as JobView
const lifecycle = () => testApp.app.get<LifecycleService>(LIFECYCLE_SERVICE)
const daysAgo = (count: number) => new Date(Date.now() - count * 24 * 3600 * 1000)

describe('the retention settings', () => {
  it('start from the environment, readable by a moderator, changeable by an admin with a reason, and audited', async () => {
    const read = await api().get('/api/v1/admin/retention').set(bearer(moderator)).expect(200)
    expect(job(read.body, 'playerActivity')).toMatchObject({
      values: { isEnabled: true, days: 400 },
      isOverridden: false
    })

    await api().patch('/api/v1/admin/retention').set(bearer(moderator)).send({ jobs: {}, reason: 'x' }).expect(403)
    const changed = await patch({ executions: { days: 3 } }).expect(200)
    expect(job(changed.body, 'executions')).toMatchObject({ values: { days: 3 }, isOverridden: true })

    const entry = await database.client.adminAuditEntry.findFirstOrThrow({ where: { action: 'retention.update' } })
    expect(entry).toMatchObject({ reason: 'tuning', actorId: admin.userId })
    expect((entry.after as { executions: { days: number } }).executions.days).toBe(3)
    await api().post('/api/v1/admin/retention/reset').set(bearer(admin)).send({ reason: 'back' }).expect(200)
  })

  it('refuse a value outside its range, a field that does not exist, and a missing reason', async () => {
    const refused = await patch({ executions: { days: 0 } }).expect(400)
    expect(refused.body.error).toContain('executions.days')
    await patch({ executions: { nothing: 1 } }).expect(400)
    await patch({ monitoring: { isEnabled: false } }).expect(400)
    await api()
      .patch('/api/v1/admin/retention')
      .set(bearer(admin))
      .send({ jobs: { executions: { days: 3 } } })
      .expect(400)
  })

  it('need the typed word to switch the erasure of inactive accounts on', async () => {
    await patch({ inactiveAccounts: { isEnabled: false } }).expect(200)

    const refused = await patch({ inactiveAccounts: { isEnabled: true } }).expect(400)
    expect(refused.body.error).toContain('ERASE')
    await patch({ inactiveAccounts: { isEnabled: true } }, { confirmation: 'ERASE' }).expect(200)
    await api().post('/api/v1/admin/retention/reset').set(bearer(admin)).send({ reason: 'back' }).expect(200)
  })
})

describe('a pass of the job', () => {
  async function activity(name: string) {
    const user = await database.client.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email: `${name}@example.com`,
        status: 'user',
        subscription: 'free',
        createdAt: new Date()
      }
    })
    await database.client.playerActivity.create({ data: { userId: user.id, day: daysAgo(200) } })
    return user.id
  }

  it('obeys what the console set, with no restart: a range, a switch, and the reset', async () => {
    const userId = await activity('retained')
    const count = () => database.client.playerActivity.count({ where: { userId } })

    await lifecycle().runOnce()
    expect(await count()).toBe(1)

    await patch({ playerActivity: { isEnabled: false, days: 100 } }).expect(200)
    await lifecycle().runOnce()
    expect(await count()).toBe(1)

    await patch({ playerActivity: { isEnabled: true } }).expect(200)
    const report = await lifecycle().runOnce()
    expect(report.playerActivityDeleted).toBeGreaterThanOrEqual(1)
    expect(await count()).toBe(0)

    const shown = await api().get('/api/v1/admin/retention').set(bearer(admin)).expect(200)
    expect(shown.body.lastRunAt).toEqual(expect.any(Number))
    expect(shown.body.hasFailures).toBe(false)
    expect(
      (shown.body.jobs as Array<{ job: string; lastRemoved: number }>).find((j) => j.job === 'playerActivity')
        ?.lastRemoved
    ).toBeGreaterThanOrEqual(1)

    await api().post('/api/v1/admin/retention/reset').set(bearer(admin)).send({ reason: 'back' }).expect(200)
    const again = await api().get('/api/v1/admin/retention').set(bearer(admin)).expect(200)
    expect(job(again.body, 'playerActivity')).toMatchObject({ values: { days: 400 }, isOverridden: false })
  })

  it('does nothing while the whole job is switched off', async () => {
    const userId = await activity('kept')
    await patch({ lifecycle: { isEnabled: false }, playerActivity: { days: 100 } }).expect(200)

    await lifecycle().runOnce()
    expect(await database.client.playerActivity.count({ where: { userId } })).toBe(1)

    await api().post('/api/v1/admin/retention/reset').set(bearer(admin)).send({ reason: 'back' }).expect(200)
  })
})
