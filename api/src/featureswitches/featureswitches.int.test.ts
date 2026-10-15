import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { PASSWORD, signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { PRIVACY_POLICY_VERSION } from '../../../lib/utils/privacy'

let database: TestDatabase
let testApp: TestApp
let admin: SignedUp
let player: SignedUp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  admin = await signUpAdmin(testApp, database, 'admin')
  player = await signUpVerified(testApp, database, 'features-player@example.com', 'Features')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const api = () => request(testApp.url)
const setFeature = (features: Record<string, boolean>, reason = 'incident 7') =>
  api().patch('/api/v1/admin/features').set(bearer(admin.accessToken)).send({ features, reason })
const register = (email: string) =>
  api()
    .post('/api/v1/auth/register')
    .send({ name: 'New', email, password: PASSWORD, acceptedPrivacyVersion: PRIVACY_POLICY_VERSION })

describe('the switches', () => {
  it('start all on, are public, and change with a reason and an audit entry', async () => {
    const status = await api().get('/api/v1/features').expect(200)
    expect(Object.values(status.body.features).every(Boolean)).toBe(true)

    const changed = await setFeature({ signUps: false }).expect(200)
    expect(changed.body.features.signUps).toBe(false)
    expect(changed.body.updatedAt).toEqual(expect.any(Number))
    expect((await api().get('/api/v1/features')).body.features.signUps).toBe(false)

    const entry = await database.client.adminAuditEntry.findFirstOrThrow({ where: { action: 'features.update' } })
    expect(entry).toMatchObject({ reason: 'incident 7', actorId: admin.userId, outcome: 'success' })
    expect(entry.before).toMatchObject({ signUps: true })
    expect(entry.after).toMatchObject({ signUps: false })
    await setFeature({ signUps: true }).expect(200)
  })

  it('refuse a bad patch and a missing reason, and a player cannot read the console copy', async () => {
    await setFeature({ nothing: true }).expect(400)
    await setFeature({ signUps: 'off' as never }).expect(400)
    await api()
      .patch('/api/v1/admin/features')
      .set(bearer(admin.accessToken))
      .send({ features: { signUps: false } })
      .expect(400)
    await api().get('/api/v1/admin/features').set(bearer(player.accessToken)).expect(403)
    expect(
      (await api().get('/api/v1/admin/features').set(bearer(admin.accessToken)).expect(200)).body.features
    ).toBeDefined()
  })
})

describe('the enforcement', () => {
  afterEach(async () => {
    await setFeature({ signUps: true, baseDeployment: true, apiKeys: true, spawnSeeds: true, publicApi: true })
  })

  it('sign-ups: refused with FEATURE_DISABLED, allowed again after the switch back', async () => {
    await setFeature({ signUps: false }).expect(200)
    const refused = await register('closed@example.com').expect(403)
    expect(refused.body.code).toBe('FEATURE_DISABLED')
    expect(refused.body.error).toContain('signUps')

    await setFeature({ signUps: true }).expect(200)
    await register('open@example.com').expect(201)
  })

  it('base deployment and spawn seeds', async () => {
    await setFeature({ baseDeployment: false }).expect(200)
    const refused = await api()
      .post('/api/v1/bots/base')
      .set(bearer(player.accessToken))
      .send({ password: 'secret1' })
      .expect(403)
    expect(refused.body.code).toBe('FEATURE_DISABLED')

    await setFeature({ baseDeployment: true, spawnSeeds: false }).expect(200)
    await api()
      .post('/api/v1/bots/base')
      .set(bearer(player.accessToken))
      .send({ password: 'secret1', spawnSeed: 'ALPHA-7K2' })
      .expect(403)
    await api().post('/api/v1/bots/base').set(bearer(player.accessToken)).send({ password: 'secret1' }).expect(201)
  })

  it('API keys: creating them and using them are separate switches, and sessions are never touched', async () => {
    const create = () =>
      api()
        .post('/api/v1/api-keys')
        .set(bearer(player.accessToken))
        .send({ name: 'k', scopes: ['read'] })
    const key = (await create().expect(201)).body.secret as string

    await setFeature({ apiKeys: false }).expect(200)
    expect((await create().expect(403)).body.code).toBe('FEATURE_DISABLED')
    await api().get('/api/v1/bots').set(bearer(key)).expect(200)

    await setFeature({ apiKeys: true, publicApi: false }).expect(200)
    expect((await api().get('/api/v1/bots').set(bearer(key)).expect(403)).body.code).toBe('FEATURE_DISABLED')
    await api().get('/api/v1/bots').set(bearer(player.accessToken)).expect(200)
  })
})
