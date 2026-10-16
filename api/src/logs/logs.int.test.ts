import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'
import { ENGINE_PORT } from '../engine/application/engine-port'
import { QUERY_STATS, QueryStats } from '../persistence/application/query-stats'

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

  it('finds the lines of a trace, pages through the newest first, and lists the node', async () => {
    const served = await api().get('/api/v1/users/me').set(bearer(player)).expect(200)
    const traceId = served.headers['x-trace-id'] as string

    const byTrace = await api().get(`/api/v1/admin/logs?traceId=${traceId}`).set(bearer(admin)).expect(200)
    expect(byTrace.body.store).toBe('memory')
    expect(byTrace.body.lines).toEqual([
      expect.objectContaining({ traceId, requestId: traceId, node: expect.any(String), service: 'botrts-api' })
    ])
    // The searches log themselves, so the page is pinned to the lines written before it
    const before = new Date().toISOString()
    const all = await api().get(`/api/v1/admin/logs?results=2&to=${before}`).set(bearer(admin)).expect(200)
    const rest = await api().get(`/api/v1/admin/logs?results=2&offset=1&to=${before}`).set(bearer(admin)).expect(200)
    expect(rest.body.lines[0]).toEqual(all.body.lines[1])
    const nodes = await api().get('/api/v1/admin/logs/nodes').set(bearer(admin)).expect(200)
    expect(nodes.body).toEqual([{ id: byTrace.body.lines[0].node, services: ['botrts-api'] }])
    const elsewhere = await api().get('/api/v1/admin/logs?node=elsewhere:1').set(bearer(admin)).expect(200)
    expect(elsewhere.body.lines).toEqual([])
  })

  it('lists the slow database queries of the node, without parameters', async () => {
    const stats = testApp.app.get<QueryStats>(QUERY_STATS)
    stats.observe(5000, 'SELECT * FROM "users" WHERE "email" = $1')

    const slow = await api().get('/api/v1/admin/logs/slow-queries').set(bearer(admin)).expect(200)

    expect(slow.body[0]).toEqual({
      at: expect.any(Number),
      durationMs: 5000,
      statement: 'SELECT * FROM "users" WHERE "email" = $1'
    })
    await api().get('/api/v1/admin/logs/slow-queries').set(bearer(moderator)).expect(403)
  })

  it('filters by time and level, and validates the query', async () => {
    const future = await api().get('/api/v1/admin/logs?from=2999-01-01T00:00:00Z').set(bearer(admin)).expect(200)
    expect(future.body.lines).toEqual([])
    const past = await api().get('/api/v1/admin/logs?to=2000-01-01T00:00:00Z').set(bearer(admin)).expect(200)
    expect(past.body.lines).toEqual([])
    await api().get('/api/v1/admin/logs?level=debug').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?results=1000').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?requestId=bad id!').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?traceId=not-a-trace').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?userId=not-a-uuid').set(bearer(admin)).expect(400)
    await api().get('/api/v1/admin/logs?offset=-1').set(bearer(admin)).expect(400)
  })

  it('writes an audit entry for every search, with what was asked and not what was found', async () => {
    const asked = new Date('2026-01-01T00:00:00Z')
    await api()
      .get(
        `/api/v1/admin/logs?q=secret-topic&level=warn&node=host:1&offset=2&from=${asked.toISOString()}&to=2026-01-02T00:00:00Z`
      )
      .set(bearer(admin))
      .expect(200)

    const trail = await api().get('/api/v1/admin/audit?action=logs.search').set(bearer(admin)).expect(200)
    expect(trail.body.result[0]).toMatchObject({
      action: 'logs.search',
      targetType: 'log',
      actorId: admin.userId,
      outcome: 'success',
      after: {
        text: 'secret-topic',
        level: 'warn',
        node: 'host:1',
        offset: 2,
        from: asked.toISOString(),
        to: '2026-01-02T00:00:00.000Z'
      }
    })
    expect(JSON.stringify(trail.body.result[0])).not.toContain('lines')
  })

  it('is for roles with logs.read only', async () => {
    await api().get('/api/v1/admin/logs').set(bearer(moderator)).expect(403)
    await api().get('/api/v1/admin/logs').set(bearer(analyst)).expect(403)
    await api().get('/api/v1/admin/logs').set(bearer(player)).expect(403)
    await api().get('/api/v1/admin/logs/nodes').set(bearer(moderator)).expect(403)
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
    expect(lines[0]).toBe('time,actor,role,action,outcome,target type,target,reason,before,after,ip,request,api key')
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
