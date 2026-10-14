import request from 'supertest'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { PASSWORD, signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { totpCodeAt } from './infrastructure/crypto-totp'

let database: TestDatabase
let testApp: TestApp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const api = () => request(testApp.url)
let counter = 0

async function signUpWithRole(status: 'owner' | 'admin' | 'moderator' | 'analyst' | 'user'): Promise<SignedUp> {
  counter += 1
  const player = await signUpVerified(testApp, database, `${status}${counter}@example.com`)
  await database.client.user.update({ where: { id: player.userId }, data: { status } })

  return player
}

// Enrolls the second factor of an admin and returns what they would keep: the secret and the recovery codes
async function enroll(player: SignedUp) {
  const begun = await api().post('/api/v1/admin/2fa/enroll').set(bearer(player.accessToken)).expect(201)
  const confirmed = await api()
    .post('/api/v1/admin/2fa/confirm')
    .set(bearer(player.accessToken))
    .send({ code: totpCodeAt(begun.body.secret, Date.now()) })
    .expect(200)

  return { secret: begun.body.secret as string, recoveryCodes: confirmed.body.recoveryCodes as string[] }
}

async function auditOf(player: SignedUp) {
  return database.client.adminAuditEntry.findMany({ where: { actorId: player.userId }, orderBy: { at: 'asc' } })
}

describe('access to the admin namespace', () => {
  it('turns away anonymous callers and players without an admin role', async () => {
    await api().get('/api/v1/admin/me').expect(401)
    for (const status of ['user'] as const) {
      const player = await signUpWithRole(status)
      await api().get('/api/v1/admin/me').set(bearer(player.accessToken)).expect(403)
      await api().get('/api/v1/admin/audit').set(bearer(player.accessToken)).expect(403)
      await api().post('/api/v1/admin/2fa/enroll').set(bearer(player.accessToken)).expect(403)
    }
  })

  it('shows an admin their role and permissions, with the second factor not yet set up', async () => {
    const moderator = await signUpWithRole('moderator')
    const me = await api().get('/api/v1/admin/me').set(bearer(moderator.accessToken)).expect(200)

    expect(me.body.role).toBe('moderator')
    expect(me.body.permissions).toContain('players.ban')
    expect(me.body.permissions).not.toContain('audit.read')
    expect(me.body.twoFactor).toEqual({ isEnrolled: false, isVerified: false })
  })

  it('refuses an API key on every admin route, even the key of an owner', async () => {
    const owner = await signUpWithRole('owner')
    const created = await api()
      .post('/api/v1/api-keys')
      .set(bearer(owner.accessToken))
      .send({ name: 'k', scopes: ['read'] })
      .expect(201)
    const asKey = bearer(created.body.secret)

    await api().get('/api/v1/admin/me').set(asKey).expect(403)
    await api().get('/api/v1/admin/audit').set(asKey).expect(403)
  })
})

describe('the second factor', () => {
  it('blocks permission routes until the session is verified, then lets the admin in', async () => {
    const owner = await signUpWithRole('owner')

    const blocked = await api().get('/api/v1/admin/audit').set(bearer(owner.accessToken)).expect(403)
    expect(blocked.body.code).toBe('TWO_FACTOR_REQUIRED')

    const { secret } = await enroll(owner)

    await api().get('/api/v1/admin/audit').set(bearer(owner.accessToken)).expect(200)
    const me = await api().get('/api/v1/admin/me').set(bearer(owner.accessToken)).expect(200)
    expect(me.body.twoFactor).toEqual({ isEnrolled: true, isVerified: true })
    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect((await database.client.adminTwoFactor.findMany()).map((row) => row.secretEncrypted).join()).not.toContain(
      secret
    )
  })

  it('needs a code, or a recovery code once, for each new session, and rejects a wrong or repeated code', async () => {
    const owner = await signUpWithRole('owner')
    const { secret, recoveryCodes } = await enroll(owner)
    const second = await api().post('/api/v1/auth/login').send({ email: owner.email, password: PASSWORD }).expect(200)
    const token = bearer(second.body.accessToken)

    await api().get('/api/v1/admin/audit').set(token).expect(403)
    await api().post('/api/v1/admin/2fa/verify').set(token).send({ code: '000000' }).expect(403)
    // The step used to confirm the enrollment cannot be replayed
    await api()
      .post('/api/v1/admin/2fa/verify')
      .set(token)
      .send({ code: totpCodeAt(secret, Date.now()) })
      .expect(403)
    await api().post('/api/v1/admin/2fa/verify').set(token).send({ code: recoveryCodes[0] }).expect(204)
    await api().get('/api/v1/admin/audit').set(token).expect(200)
    // A recovery code is single-use
    const third = await api().post('/api/v1/auth/login').send({ email: owner.email, password: PASSWORD }).expect(200)
    await api()
      .post('/api/v1/admin/2fa/verify')
      .set(bearer(third.body.accessToken))
      .send({ code: recoveryCodes[0] })
      .expect(403)
    await api().post('/api/v1/admin/2fa/verify').set(token).send({}).expect(400)
  })

  it('does not replace an enabled factor and has nothing to verify before enrolling', async () => {
    const owner = await signUpWithRole('owner')
    await api().post('/api/v1/admin/2fa/verify').set(bearer(owner.accessToken)).send({ code: '123456' }).expect(400)
    await enroll(owner)

    await api().post('/api/v1/admin/2fa/enroll').set(bearer(owner.accessToken)).expect(400)
  })
})

describe('permissions', () => {
  it('holds a verified admin to the permissions of the role and audits the refusal', async () => {
    const moderator = await signUpWithRole('moderator')
    await enroll(moderator)

    await api().get('/api/v1/admin/audit').set(bearer(moderator.accessToken)).expect(403)

    const entries = await auditOf(moderator)
    expect(entries.find((entry) => entry.outcome === 'denied')).toMatchObject({
      action: 'audit.read',
      actorRole: 'moderator'
    })
  })
})

describe('the audit trail', () => {
  it('records the second-factor calls and lists entries with filters and pages', async () => {
    const owner = await signUpWithRole('owner')
    await enroll(owner)

    const page = await api()
      .get(`/api/v1/admin/audit?actorId=${owner.userId}&results=1&page=1`)
      .set(bearer(owner.accessToken))
      .expect(200)

    expect(page.body.meta.pagination).toMatchObject({ page: 1, results: 1 })
    expect(page.body.meta.pagination.total).toBeGreaterThanOrEqual(2)
    expect(page.body.result[0]).toMatchObject({ actorId: owner.userId, outcome: 'success', ip: expect.any(String) })
    expect((await auditOf(owner)).map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['admin.2fa.begin-enrollment', 'admin.2fa.confirm-enrollment'])
    )

    const filtered = await api()
      .get(
        `/api/v1/admin/audit?action=admin.2fa.begin-enrollment&outcome=success&from=2000-01-01T00:00:00Z&to=2999-01-01T00:00:00Z`
      )
      .set(bearer(owner.accessToken))
      .expect(200)
    expect(
      filtered.body.result.every((entry: { action: string }) => entry.action === 'admin.2fa.begin-enrollment')
    ).toBe(true)
    await api().get('/api/v1/admin/audit?results=1000').set(bearer(owner.accessToken)).expect(400)
  })

  it('is append-only: the database refuses updates, deletes and truncation', async () => {
    const owner = await signUpWithRole('owner')
    await enroll(owner)
    const [entry] = await auditOf(owner)

    await expect(
      database.client.adminAuditEntry.update({ where: { id: entry.id }, data: { reason: 'edited' } })
    ).rejects.toThrow(/append-only/)
    await expect(database.client.adminAuditEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/)
    await expect(database.client.$executeRawUnsafe('TRUNCATE admin_audit_log')).rejects.toThrow(/append-only/)
  })

  it('outlives the account of the admin', async () => {
    const owner = await signUpWithRole('owner')
    await enroll(owner)
    await database.client.user.delete({ where: { id: owner.userId } })

    expect((await auditOf(owner)).length).toBeGreaterThan(0)
  })
})
