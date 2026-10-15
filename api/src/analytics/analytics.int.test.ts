import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let analyst: SignedUp
let moderator: SignedUp
let p1: SignedUp
let p2: SignedUp
let p3: SignedUp
let unverified: SignedUp

const DAY_MS = 24 * 60 * 60 * 1000
const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)
const dayOf = (date: Date) => date.toISOString().slice(0, 10)
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)
const at = (day: string, offset: number) => new Date(Date.parse(day) + offset * DAY_MS)
// The Monday of the week of a date
const mondayOf = (date: Date) => dayOf(new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS))

// The three players of the cohort signed up 45 days ago
const signedUp = dayOf(daysAgo(45))
const cohort = mondayOf(new Date(`${signedUp}T12:00:00Z`))

const counter = (user: SignedUp, name: string) =>
  database.client.achievementCounter.create({
    data: { userId: user.userId, counter: name, value: 3n, updatedAt: new Date() }
  })
const activeOn = (user: SignedUp, day: Date) =>
  database.client.playerActivity.create({ data: { userId: user.userId, day } })

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  p1 = await signUpVerified(testApp, database, 'p1-an@example.com', 'Player One')
  p2 = await signUpVerified(testApp, database, 'p2-an@example.com', 'Player Two')
  p3 = await signUpVerified(testApp, database, 'p3-an@example.com', 'Player Three')
  unverified = await signUpVerified(testApp, database, 'p4-an@example.com', 'Player Four')
  await database.client.localCredential.update({ where: { userId: unverified.userId }, data: { emailVerified: false } })

  for (const player of [p1, p2, p3]) {
    await database.client.user.update({
      where: { id: player.userId },
      data: { createdAt: new Date(`${signedUp}T12:00:00Z`) }
    })
  }
  await activeOn(p1, at(signedUp, 1))
  await activeOn(p1, at(signedUp, 7))
  await activeOn(p1, at(signedUp, 30))
  await activeOn(p2, at(signedUp, 1))
  await activeOn(p2, at(signedUp, 7))

  await counter(p1, 'basesDeployed')
  await counter(p1, 'scriptRuns')
  await counter(p1, 'unitsMined')
  await counter(p1, 'tutorialsCompleted')
  await counter(p2, 'basesDeployed')
  await counter(p3, 'scriptRuns').then(() =>
    database.client.achievementCounter.update({
      where: { userId_counter: { userId: p3.userId, counter: 'scriptRuns' } },
      data: { value: 0n }
    })
  )
  for (const [user, id] of [
    [p1, 'firstSteps'],
    [p1, 'helloWorld'],
    [p2, 'firstSteps']
  ] as const) {
    await database.client.achievementUnlock.create({
      data: { userId: user.userId, achievementId: id, unlockedAt: new Date() }
    })
  }
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('the days of activity', () => {
  it('are noted once for a day, whatever the number of sign-ins', async () => {
    const today = new Date(`${dayOf(new Date())}T00:00:00Z`)

    await api().post('/api/v1/auth/login').send({ email: 'p1-an@example.com', password: 'Passw0rd!x' }).expect(200)
    await api().post('/api/v1/auth/login').send({ email: 'p1-an@example.com', password: 'Passw0rd!x' }).expect(200)

    expect(await database.client.playerActivity.count({ where: { userId: p1.userId, day: today } })).toBe(1)
  })
})

describe('who may read the analytics', () => {
  it('lets an analyst and an owner, and no moderator', async () => {
    await api().get('/api/v1/admin/analytics').set(bearer(analyst)).expect(200)
    await api().get('/api/v1/admin/analytics').set(bearer(owner)).expect(200)
    await api().get('/api/v1/admin/analytics').set(bearer(moderator)).expect(403)
    await api().get('/api/v1/admin/analytics').set(bearer(p1)).expect(403)
  })

  it('takes a window of 7, 30 or 90 days', async () => {
    expect((await api().get('/api/v1/admin/analytics?days=7').set(bearer(analyst))).body.activity.daily).toHaveLength(7)
    expect((await api().get('/api/v1/admin/analytics').set(bearer(analyst))).body.activity.daily).toHaveLength(30)
    await api().get('/api/v1/admin/analytics?days=10').set(bearer(analyst)).expect(400)
  })
})

describe('the report', () => {
  const report = async () => (await api().get('/api/v1/admin/analytics?days=90').set(bearer(analyst)).expect(200)).body

  it('counts players, not admins', async () => {
    expect((await report()).players).toBe(4)
  })

  it('counts the players active each day, today and this month', async () => {
    const { activity } = await report()
    const day = (value: string) => activity.daily.find((entry: { day: string }) => entry.day === value)

    expect(activity.daily).toHaveLength(90)
    expect(day(dayOf(at(signedUp, 1)))).toEqual({ day: dayOf(at(signedUp, 1)), users: 2 })
    expect(day(dayOf(at(signedUp, 7))).users).toBe(2)
    // Every test player signed in today; the admins do not count
    expect(activity.dau).toBe(4)
    expect(activity.mau).toBe(4)
  })

  it('measures retention of the weekly cohort of sign-ups', async () => {
    const { retention } = await report()

    expect(retention.find((row: { cohort: string }) => row.cohort === cohort)).toEqual({
      cohort,
      size: 3,
      d1: 2 / 3,
      d7: 2 / 3,
      d30: 1 / 3
    })
  })

  it('counts how far the players got', async () => {
    const { funnel } = await report()

    expect(funnel.map((step: { step: string; users: number }) => [step.step, step.users])).toEqual([
      ['signedUp', 4],
      ['verified', 3],
      ['baseDeployed', 2],
      ['firstScript', 1],
      ['firstResource', 1],
      ['tutorialCompleted', 1]
    ])
  })

  it('gives the share of the players who earned each achievement', async () => {
    const { achievements } = await report()

    expect(achievements).toEqual([
      { id: 'firstSteps', unlocked: 2, share: 0.5 },
      { id: 'helloWorld', unlocked: 1, share: 0.25 }
    ])
  })
})

describe('the export', () => {
  it('gives each report as CSV, and is audited', async () => {
    const funnel = await api()
      .get('/api/v1/admin/analytics/export?report=funnel&days=90')
      .set(bearer(analyst))
      .expect(200)
    expect(funnel.headers['content-type']).toContain('text/csv')
    expect(funnel.text).toBe(
      'step,players\nsignedUp,4\nverified,3\nbaseDeployed,2\nfirstScript,1\nfirstResource,1\ntutorialCompleted,1\n'
    )
    const achievements = await api()
      .get('/api/v1/admin/analytics/export?report=achievements&days=90')
      .set(bearer(owner))
      .expect(200)
    expect(achievements.text).toContain('firstSteps,2,50')

    expect(await database.client.adminAuditEntry.count({ where: { action: 'analytics.export' } })).toBe(2)
  })

  it('refuses an unknown report, and a role without the permission', async () => {
    await api().get('/api/v1/admin/analytics/export?report=nope').set(bearer(analyst)).expect(400)
    await api().get('/api/v1/admin/analytics/export?report=funnel').set(bearer(moderator)).expect(403)
  })
})
