import { readFileSync } from 'fs'
import { join } from 'path'
import request from 'supertest'
import { ADMIN_API_SCOPES } from '../../../lib/utils/admin-api-keys'
import { API_SCOPES } from '../../../lib/utils/interfaces/api-keys'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { SignedUp, signUpVerified, startTestApp, TestApp } from '../../tests/integration/test-app'

// Admin read scopes on API keys (design §25.2): granted in the console only, held to the role of the owner on every call, audited with
// the key id, and invisible to players.

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let moderator: SignedUp
let player: SignedUp

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const freshAdmin = () => signUpAdmin(testApp, database, 'admin')
const grant = (token: string, body: Record<string, unknown> = {}) =>
  request(testApp.url)
    .post('/api/v1/admin/api-keys')
    .set(bearer(token))
    .send({ name: 'Assistant', scopes: ['admin:audit:read'], reason: 'investigating', expiresInDays: 7, ...body })

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  player = await signUpVerified(testApp, database, 'player-adminkeys@example.com', 'Player')
}, 60000)
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

describe('granting an admin key', () => {
  it('is for an admin of the console, who gets the secret once, with a reason and an expiry', async () => {
    const created = await grant(admin.accessToken, { ipAllowList: ['203.0.113.7'] }).expect(201)

    expect(created.body).toMatchObject({
      name: 'Assistant',
      scopes: ['admin:audit:read'],
      reason: 'investigating',
      ipAllowList: ['203.0.113.7'],
      ownerId: admin.userId
    })
    expect(created.body.secret).toMatch(/^botrts_/)
    expect(created.body.expiresAt).toBeGreaterThan(Date.now())
    const listed = await request(testApp.url).get('/api/v1/admin/api-keys').set(bearer(admin.accessToken)).expect(200)
    expect(JSON.stringify(listed.body)).not.toContain(created.body.secret)
    expect(listed.body.map((key: { _id: string }) => key._id)).toContain(created.body._id)
    const entry = await database.client.adminAuditEntry.findFirst({ where: { action: 'apikeys.admin.create' } })
    expect(entry).toMatchObject({ targetId: created.body._id, reason: 'investigating' })
    expect(JSON.stringify(entry)).not.toContain(created.body.secret)
  })

  it('is refused to a player, to a role without the scope, to a lifetime over the setting and to an unknown scope', async () => {
    await grant(player.accessToken).expect(403)
    await grant(moderator.accessToken, { scopes: ['admin:audit:read'] }).expect(403)
    await grant(admin.accessToken, { expiresInDays: 31 }).expect(400)
    await grant(admin.accessToken, { scopes: ['read'] }).expect(400)
    await grant(admin.accessToken, { reason: '' }).expect(400)
    await grant(admin.accessToken, { ipAllowList: ['not an address'] }).expect(400)
  })

  it('cannot be reached by a key at all, even by an admin key', async () => {
    const admin = await freshAdmin()
    const { body } = await grant(admin.accessToken).expect(201)

    const refused = await request(testApp.url)
      .post('/api/v1/admin/api-keys')
      .set(bearer(body.secret))
      .send({ name: 'x', scopes: ['admin:audit:read'], reason: 'escalate', expiresInDays: 1 })
      .expect(403)
    expect(refused.body.code).toBe('SESSION_ONLY')
  })
})

describe('what a player can do about admin scopes', () => {
  it('never creates a key with one, whoever the player is, and never sees an admin key', async () => {
    const admin = await freshAdmin()
    for (const token of [player.accessToken, admin.accessToken]) {
      await request(testApp.url)
        .post('/api/v1/api-keys')
        .set(bearer(token))
        .send({ name: 'escalate', scopes: ['read', 'admin:audit:read'] })
        .expect(400)
    }
    const { body } = await grant(admin.accessToken).expect(201)

    const own = await request(testApp.url).get('/api/v1/api-keys').set(bearer(admin.accessToken)).expect(200)
    expect(own.body.map((key: { _id: string }) => key._id)).not.toContain(body._id)
    const revoked = await request(testApp.url).delete(`/api/v1/api-keys/${body._id}`).set(bearer(admin.accessToken))
    expect(revoked.status).toBe(404)
  })
})

describe('using an admin key', () => {
  it('reaches only the routes that opt in with its scope, and every call is audited with the key id', async () => {
    const admin = await freshAdmin()
    const { body } = await grant(admin.accessToken).expect(201)
    const key = bearer(body.secret)

    await request(testApp.url).get('/api/v1/admin/audit').set(key).expect(200)
    const closedAdmin = await request(testApp.url).get('/api/v1/admin/security').set(key).expect(403)
    expect(closedAdmin.body.code).toBe('SESSION_ONLY')
    const gameRoute = await request(testApp.url).get('/api/v1/bots').set(key).expect(403)
    expect(gameRoute.body.code).toBe('API_KEY_SCOPE')
    const wrongScope = await grant(admin.accessToken, { scopes: ['admin:logs:read'] }).expect(201)
    const missing = await request(testApp.url)
      .get('/api/v1/admin/audit')
      .set(bearer(wrongScope.body.secret))
      .expect(403)
    expect(missing.body.code).toBe('API_KEY_SCOPE')

    const entries = await database.client.adminAuditEntry.findMany({ where: { apiKeyId: body._id } })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actorId: admin.userId, outcome: 'success', action: 'GET /api/v1/admin/audit' })
  })

  it('is held to its addresses', async () => {
    const admin = await freshAdmin()
    const { body } = await grant(admin.accessToken, { ipAllowList: ['203.0.113.9'] }).expect(201)

    const refused = await request(testApp.url).get('/api/v1/admin/audit').set(bearer(body.secret)).expect(403)
    expect(refused.body.code).toBe('API_KEY_IP_NOT_ALLOWED')
  })

  it('stops at once when the owner is demoted or banned, and when the key is revoked', async () => {
    const owner = await signUpAdmin(testApp, database, 'admin')
    const first = await grant(owner.accessToken).expect(201)
    const second = await grant(owner.accessToken).expect(201)
    const third = await grant(owner.accessToken).expect(201)
    const useKey = (secret: string) => request(testApp.url).get('/api/v1/admin/audit').set(bearer(secret))
    await useKey(first.body.secret).expect(200)

    await request(testApp.url)
      .post(`/api/v1/admin/api-keys/${third.body._id}/revoke`)
      .set(bearer(admin.accessToken))
      .send({ reason: 'not needed' })
      .expect(204)
    await useKey(third.body.secret).expect(401)

    await database.client.user.update({ where: { id: owner.userId }, data: { status: 'user' } })
    await useKey(first.body.secret).expect(401)
    await database.client.user.update({ where: { id: owner.userId }, data: { status: 'banned' } })
    await useKey(second.body.secret).expect(403)
  })
})

describe('where the admin scopes are visible', () => {
  const read = (...path: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...path), 'utf8')
  const hasAdminScope = (text: string) => ADMIN_API_SCOPES.some((scope) => text.includes(scope))

  it('is not in the player scope list, the public spec, the generated client or the player documentation', async () => {
    expect(API_SCOPES.some((scope) => scope.startsWith('admin:'))).toBe(false)
    expect(hasAdminScope(read('api', 'openapi.json'))).toBe(false)
    expect(hasAdminScope(read('client', 'src', 'shared', 'api', 'generated.ts'))).toBe(false)
    const docs = request(testApp.url).get('/api/v1/api-keys').set(bearer(player.accessToken))
    expect(hasAdminScope(JSON.stringify((await docs).body))).toBe(false)
  })
})
