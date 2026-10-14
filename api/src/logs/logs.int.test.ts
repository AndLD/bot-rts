import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let owner: SignedUp
let player: SignedUp

const slowTick = { tick: 9, durationMs: 150, intervalMs: 100, isCut: true, queuedExecutions: 1, deferredExecutions: 2 }

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)

beforeAll(async () => {
  database = await createTestDatabase()
  const engine = { metrics: async () => ({ slowTicks: [slowTick] }), onEvent: () => () => undefined }
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' }, [{ provide: ENGINE_PORT, useValue: engine }])
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
  player = await signUpVerified(testApp, database, 'logged@example.com', 'Logged')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('the log search', () => {
  it('finds the line of a request by its id, and by a part of the text', async () => {
    const served = await api()
      .get('/api/v1/users/me')
      .set(bearer(player))
      .set('X-Request-Id', 'trace-me-123')
      .expect(200)
    expect(served.headers['x-request-id']).toBe('trace-me-123')

    const byRequest = await api().get('/api/v1/admin/logs?requestId=trace-me-123').set(bearer(admin)).expect(200)
    expect(byRequest.body.lines).toEqual([
      expect.objectContaining({
        level: 'info',
        requestId: 'trace-me-123',
        message: expect.stringContaining('GET /api/v1/users/me 200')
      })
    ])
    expect(byRequest.body.capacity).toBe(5000)

    const byText = await api().get('/api/v1/admin/logs?q=users/ME&level=info&results=5').set(bearer(admin)).expect(200)
    expect(byText.body.total).toBeGreaterThan(0)
    expect(byText.body.lines.length).toBeLessThanOrEqual(5)
    const none = await api().get('/api/v1/admin/logs?q=text-nobody-logged').set(bearer(admin)).expect(200)
    expect(none.body).toMatchObject({ lines: [], total: 0 })
  })

  it('filters by time and level, and validates the query', async () => {
    const future = await api().get('/api/v1/admin/logs?from=2999-01-01T00:00:00Z').set(bearer(admin)).expect(200)
    expect(future.body.lines).toEqual([])
    const past = await api().get('/api/v1/admin/logs?to=2000-01-01T00:00:00Z').set(bearer(admin)).expect(200)
    expect(past.body.lines).toEqual([])
    await api().get('/api/v1/admin/logs?level=debug').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?results=1000').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?requestId=bad id!').set(bearer(admin)).expect(400)
  })

  it('is for roles with logs.read only', async () => {
    await api().get('/api/v1/admin/logs').set(bearer(moderator)).expect(403)
    await api().get('/api/v1/admin/logs').set(bearer(analyst)).expect(403)
    await api().get('/api/v1/admin/logs').set(bearer(player)).expect(403)
    await api().get('/api/v1/admin/logs/slow-ticks').set(bearer(moderator)).expect(403)
  })
})

describe('slow ticks', () => {
  it('lists what the engine kept', async () => {
    const slow = await api().get('/api/v1/admin/logs/slow-ticks').set(bearer(admin)).expect(200)

    expect(slow.body).toEqual([slowTick])
  })
})

describe('the audit export', () => {
  it('gives the filtered trail as CSV, and audits the export itself', async () => {
    const csv = await api()
      .get('/api/v1/admin/audit/export?action=admin.2fa.confirm-enrollment')
      .set(bearer(admin))
      .expect(200)

    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.headers['content-disposition']).toContain('audit-log.csv')
    const lines = csv.text.trim().split('\n')
    expect(lines[0]).toBe('time,actor,role,action,outcome,target type,target,reason,before,after,ip,request')
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.slice(1).every((row) => row.includes('admin.2fa.confirm-enrollment'))).toBe(true)

    const entry = await database.client.adminAuditEntry.findFirstOrThrow({
      where: { actorId: admin.userId, action: 'audit.export' }
    })
    expect(entry.outcome).toBe('success')
  })

  it('is for roles with audit.export, which an analyst, a moderator and a player lack', async () => {
    await api().get('/api/v1/admin/audit/export').set(bearer(owner)).expect(200)
    await api().get('/api/v1/admin/audit/export').set(bearer(moderator)).expect(403)
    await api().get('/api/v1/admin/audit/export').set(bearer(analyst)).expect(403)
    await api().get('/api/v1/admin/audit/export').set(bearer(player)).expect(403)
    await api().get('/api/v1/admin/audit/export?outcome=weird').set(bearer(owner)).expect(400)
  })
})
