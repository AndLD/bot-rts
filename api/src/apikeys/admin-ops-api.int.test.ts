import request from 'supertest'
import { AdminApiScope } from '../../../lib/utils/admin-api-keys'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

// The read-only operations API of the assistant (Phase 14.2): which admin key scope opens which route, and nothing else.

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
const keys = {} as Record<AdminApiScope, string>

const SCOPES: AdminApiScope[] = ['admin:logs:read', 'admin:metrics:read', 'admin:audit:read', 'admin:health:read']
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// Every route the assistant may read, with the scope that opens it
const ROUTES: Array<[string, AdminApiScope]> = [
  ['/api/v1/admin/logs', 'admin:logs:read'],
  ['/api/v1/admin/logs/nodes', 'admin:logs:read'],
  ['/api/v1/admin/logs/slow-queries', 'admin:logs:read'],
  ['/api/v1/admin/logs/slow-ticks', 'admin:logs:read'],
  [`/api/v1/admin/traces/${'ab'.repeat(16)}`, 'admin:logs:read'],
  ['/api/v1/admin/monitoring/series?metric=engine.tickP95Ms&range=1h', 'admin:metrics:read'],
  ['/api/v1/admin/monitoring/nodes?range=1h', 'admin:metrics:read'],
  ['/api/v1/admin/monitoring/health', 'admin:health:read'],
  ['/api/v1/admin/monitoring/alerts', 'admin:health:read'],
  ['/api/v1/admin/health-check', 'admin:health:read'],
  ['/api/v1/admin/supervision/state', 'admin:health:read'],
  ['/api/v1/admin/audit', 'admin:audit:read']
]

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  admin = await signUpAdmin(testApp, database, 'owner')
  for (const scope of SCOPES) {
    const { body } = await request(testApp.url)
      .post('/api/v1/admin/api-keys')
      .set(bearer(admin.accessToken))
      .send({ name: scope, scopes: [scope], reason: 'ops api test', expiresInDays: 3 })
      .expect(201)
    keys[scope] = body.secret
  }
}, 60000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('the read-only routes of the assistant', () => {
  it.each(ROUTES)('%s opens with its scope and with no other', async (url, scope) => {
    const allowed = await request(testApp.url).get(url).set(bearer(keys[scope]))
    // Past the guards the route answers what it answers (the engine may be off), but never a refusal of the key
    expect([401, 403]).not.toContain(allowed.status)

    for (const other of SCOPES.filter((candidate) => candidate !== scope)) {
      const refused = await request(testApp.url).get(url).set(bearer(keys[other]))
      expect([refused.status, refused.body.code]).toEqual([403, 'API_KEY_SCOPE'])
    }
  })

  it('composes the health check of the system in one answer', async () => {
    const { body } = await request(testApp.url)
      .get('/api/v1/admin/health-check')
      .set(bearer(keys['admin:health:read']))
      .expect(200)

    expect(body).toMatchObject({
      status: expect.stringMatching(/green|yellow|red/),
      alerts: expect.any(Array),
      tick: expect.any(Object),
      scripts: expect.any(Object),
      flush: expect.any(Object),
      store: { databaseStatus: expect.any(String) }
    })
  })

  it('keeps the rest of the console closed to every one of the keys', async () => {
    for (const secret of Object.values(keys)) {
      for (const url of ['/api/v1/admin/security', '/api/v1/admin/players', '/api/v1/admin/audit/export']) {
        const response = await request(testApp.url).get(url).set(bearer(secret))
        expect([url, response.status]).toEqual([url, 403])
      }
    }
  })

  it('writes a line of the audit trail with the key id for every call', async () => {
    const before = await database.client.adminAuditEntry.count({ where: { apiKeyId: { not: null } } })

    await request(testApp.url).get('/api/v1/admin/monitoring/health').set(bearer(keys['admin:health:read'])).expect(200)

    expect(await database.client.adminAuditEntry.count({ where: { apiKeyId: { not: null } } })).toBe(before + 1)
  })
})
