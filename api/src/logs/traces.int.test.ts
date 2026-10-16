import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let moderator: SignedUp
let player: SignedUp

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  player = await signUpVerified(testApp, database, 'traced@example.com', 'Traced')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('reading a trace without a trace store', () => {
  it('shows the lines of a request found by its trace id, and by the request id it came with', async () => {
    const served = await api()
      .get('/api/v1/users/me')
      .set(bearer(player))
      .set('X-Request-Id', 'old-request-7')
      .expect(200)
    const traceId = served.headers['x-trace-id'] as string

    const byTrace = await api().get(`/api/v1/admin/traces/${traceId}`).set(bearer(admin)).expect(200)
    const byRequest = await api().get('/api/v1/admin/traces/old-request-7').set(bearer(admin)).expect(200)

    expect(byTrace.body).toMatchObject({ traceId, store: 'memory', spans: [], isLogCut: false })
    expect(byTrace.body.logs).toEqual([
      expect.objectContaining({
        traceId,
        requestId: 'old-request-7',
        message: expect.stringContaining('GET /api/v1/users/me 200')
      })
    ])
    expect(byRequest.body).toEqual(byTrace.body)
  })

  it('answers 404 for a trace nobody logged, 400 for an id that is not one', async () => {
    await api()
      .get(`/api/v1/admin/traces/${'f'.repeat(32)}`)
      .set(bearer(admin))
      .expect(404)
    await api().get('/api/v1/admin/traces/unknown-request').set(bearer(admin)).expect(404)
    await api().get('/api/v1/admin/traces/bad id!').set(bearer(admin)).expect(400)
  })

  it('writes an audit entry for every read, with the trace id, and is for logs.read only', async () => {
    const traceId = 'e'.repeat(32)
    await api().get(`/api/v1/admin/traces/${traceId}`).set(bearer(admin)).expect(404)

    const trail = await api().get('/api/v1/admin/audit?action=logs.read-trace').set(bearer(admin)).expect(200)
    expect(trail.body.result[0]).toMatchObject({
      action: 'logs.read-trace',
      targetType: 'trace',
      targetId: traceId,
      outcome: 'failed'
    })
    await api().get(`/api/v1/admin/traces/${traceId}`).set(bearer(moderator)).expect(403)
    await api().get(`/api/v1/admin/traces/${traceId}`).set(bearer(player)).expect(403)
  })
})
