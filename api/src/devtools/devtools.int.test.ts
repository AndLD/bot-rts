import request from 'supertest'
import { TEST_EMAIL_DOMAIN } from '../../../lib/utils/admin-devtools'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp
let enabled: TestApp
let owner: SignedUp
let admin: SignedUp

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = (app: TestApp = enabled) => request(app.url)
const auditOf = (action: string) => database.client.adminAuditEntry.findFirstOrThrow({ where: { action } })

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  await testApp.close()
  enabled = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000', DEV_TOOLS_ENABLED: 'true' })
})
afterAll(async () => {
  await enabled.close()
  await database.drop()
})

describe('a server without the dev tools', () => {
  it('has no such routes', async () => {
    const plain = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
    try {
      await api(plain).get('/api/v1/admin/devtools').set(bearer(owner)).expect(404)
      await api(plain)
        .post('/api/v1/admin/devtools/seed-world')
        .set(bearer(owner))
        .send({ count: 1, reason: 'because' })
        .expect(404)
    } finally {
      await plain.close()
    }
  })
})

describe('the dev tools', () => {
  it('are for owners', async () => {
    await api().get('/api/v1/admin/devtools').set(bearer(owner)).expect(200, { isEnabled: true })
    await api().get('/api/v1/admin/devtools').set(bearer(admin)).expect(403)
    await api()
      .post('/api/v1/admin/devtools/seed-world')
      .set(bearer(admin))
      .send({ count: 1, reason: 'because' })
      .expect(403)
  })

  it('create test players who can sign in, each with a base, and audit it', async () => {
    const { body } = await api()
      .post('/api/v1/admin/devtools/seed-world')
      .set(bearer(owner))
      .send({ count: 2, reason: 'a test world' })
      .expect(200)

    expect(body.players).toHaveLength(2)
    const [first] = body.players
    expect(first.email.endsWith(`@${TEST_EMAIL_DOMAIN}`)).toBe(true)
    expect(first.baseId).toEqual(expect.any(String))
    const bases = await database.client.bot.findMany({ where: { type: 'base', userId: first.userId } })
    expect(bases).toHaveLength(1)
    await api().post('/api/v1/auth/login').send({ email: first.email, password: first.password }).expect(200)
    expect(await auditOf('devtools.seed-world')).toMatchObject({
      reason: 'a test world',
      after: { created: [expect.objectContaining({ userId: expect.any(String) }), expect.anything()] }
    })
  })

  it('refuse a count outside the limits', async () => {
    const send = (count: number) =>
      api().post('/api/v1/admin/devtools/seed-world').set(bearer(owner)).send({ count, reason: 'because' })

    await send(0).expect(400)
    await send(21).expect(400)
  })

  it('remove the test players, once', async () => {
    const before = await database.client.user.count({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } })
    expect(before).toBe(2)

    const first = await api()
      .delete('/api/v1/admin/devtools/test-players')
      .set(bearer(owner))
      .send({ reason: 'clean up' })
      .expect(200)
    const second = await api()
      .delete('/api/v1/admin/devtools/test-players')
      .set(bearer(owner))
      .send({ reason: 'clean up again' })
      .expect(200)

    expect(first.body.removed).toBe(2)
    expect(second.body.removed).toBe(0)
    expect(await database.client.user.count({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } })).toBe(0)
  })
})
