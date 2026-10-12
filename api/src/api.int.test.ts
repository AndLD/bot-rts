import { randomUUID } from 'crypto'
import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { createTestDatabase, TestDatabase } from '../tests/integration/test-database'
import { PASSWORD, signUpVerified, startTestApp, TestApp } from '../tests/integration/test-app'

// Safety-net tests: the golden flows of the whole stack (HTTP and Socket.IO → use cases → PostgreSQL)

let database: TestDatabase
let testApp: TestApp

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database)
})
beforeEach(() => database.reset())
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const api = () => request(testApp.url)
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const signUp = (email: string, name = 'Alice') => signUpVerified(testApp, database, email, name)

describe('account flows', () => {
  it('registers, is held back until the email is verified, then logs in, refreshes and logs out', async () => {
    const registered = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
      .expect(201)
    const cookie = registered.headers['set-cookie'] as unknown as string[]

    expect(cookie[0]).toMatch(/^refreshToken=.+HttpOnly/i)
    expect(cookie[0]).toContain('Path=/api/v1/auth')
    expect((await api().get('/api/v1/users/me').set(bearer(registered.body.accessToken)).expect(403)).body.code).toBe(
      'EMAIL_NOT_VERIFIED'
    )
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com', password: PASSWORD }).expect(403)

    await api()
      .post('/api/v1/auth/email/verify')
      .send({ token: testApp.emails.tokenFor('alice@example.com') })
      .expect(204)
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD })
      .expect(200)
    const me = await api().get('/api/v1/users/me').set(bearer(login.body.accessToken)).expect(200)
    expect(me.body).toMatchObject({ name: 'Alice', email: 'alice@example.com', status: 'user', active: true })

    const refreshed = await api().post('/api/v1/auth/refresh').set('Cookie', login.headers['set-cookie']).expect(200)
    expect(refreshed.body.accessToken).toEqual(expect.any(String))
    await api().post('/api/v1/auth/refresh').set('Cookie', login.headers['set-cookie']).expect(401)

    const logout = await api().post('/api/v1/auth/logout').set('Cookie', refreshed.headers['set-cookie']).expect(204)
    expect(logout.headers['set-cookie'][0]).toContain('refreshToken=;')
    await api().post('/api/v1/auth/refresh').set('Cookie', refreshed.headers['set-cookie']).expect(401)
    await api().get('/api/v1/users/me').set(bearer(refreshed.body.accessToken)).expect(401)
  })

  it('stores the password only as a hash and the refresh token and links only as hashes', async () => {
    const { userId } = await signUp('alice@example.com')
    const credential = await database.client.localCredential.findUniqueOrThrow({ where: { userId } })
    const [session, token] = [
      await database.client.session.findFirstOrThrow(),
      await database.client.authToken.findFirstOrThrow()
    ]

    expect(credential.passwordHash).not.toContain(PASSWORD)
    expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('validates input and rejects a duplicate email', async () => {
    const body = { name: 'Alice', email: 'alice@example.com', password: PASSWORD }
    await api().post('/api/v1/auth/register').send(body).expect(201)

    expect((await api().post('/api/v1/auth/register').send(body).expect(400)).body.code).toBe('EMAIL_ALREADY_EXISTS')
    expect(
      (
        await api()
          .post('/api/v1/auth/register')
          .send({ ...body, password: 'weak' })
          .expect(400)
      ).body.code
    ).toBe('VALIDATION_FAILED')
    await api()
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'not-an-email' })
      .expect(400)
    await api()
      .post('/api/v1/auth/register')
      .send({ ...body, status: 'owner' })
      .expect(400)
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com' }).expect(400)
  })

  it('answers wrong credentials the same for unknown and known emails', async () => {
    await signUp('alice@example.com')

    const unknown = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401)
    const wrong = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'Wr0ng!pass' })
      .expect(401)
    expect(unknown.body).toEqual(wrong.body)
  })

  it('resets a forgotten password and signs every device out', async () => {
    const { accessToken, cookie } = await signUp('alice@example.com')

    await api().post('/api/v1/auth/password/forgot').send({ email: 'alice@example.com' }).expect(204)
    await api().post('/api/v1/auth/password/forgot').send({ email: 'nobody@example.com' }).expect(204)
    await api()
      .post('/api/v1/auth/password/reset')
      .send({ token: testApp.emails.tokenFor('alice@example.com'), password: 'NewPassw0rd!' })
      .expect(204)

    await api().get('/api/v1/users/me').set(bearer(accessToken)).expect(401)
    await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401)
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com', password: PASSWORD }).expect(401)
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com', password: 'NewPassw0rd!' }).expect(200)
  })

  it('changes the password keeping this device signed in and the others out', async () => {
    const first = await signUp('alice@example.com')
    const second = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD })
      .expect(200)

    await api()
      .post('/api/v1/auth/password/change')
      .set(bearer(first.accessToken))
      .send({ currentPassword: 'bad', newPassword: 'NewPassw0rd!' })
      .expect(400)
    await api()
      .post('/api/v1/auth/password/change')
      .set(bearer(first.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: 'NewPassw0rd!' })
      .expect(204)

    await api().get('/api/v1/users/me').set(bearer(first.accessToken)).expect(200)
    await api().get('/api/v1/users/me').set(bearer(second.body.accessToken)).expect(401)
  })

  it('changes the email after the new mailbox confirmed it', async () => {
    const { accessToken, userId } = await signUp('alice@example.com')

    await api()
      .post('/api/v1/auth/email/change')
      .set(bearer(accessToken))
      .send({ password: 'bad', newEmail: 'new@example.com' })
      .expect(400)
    await api()
      .post('/api/v1/auth/email/change')
      .set(bearer(accessToken))
      .send({ password: PASSWORD, newEmail: 'new@example.com' })
      .expect(204)
    await api()
      .post('/api/v1/auth/email/change/confirm')
      .send({ token: testApp.emails.tokenFor('new@example.com') })
      .expect(204)

    expect((await database.client.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe('new@example.com')
    await api().post('/api/v1/auth/login').send({ email: 'new@example.com', password: PASSWORD }).expect(200)
  })

  it('deletes the account after the emailed confirmation but keeps the base', async () => {
    const { accessToken, userId } = await signUp('alice@example.com')
    const base = await api()
      .post('/api/v1/bots/base')
      .set(bearer(accessToken))
      .send({ password: 'secret1' })
      .expect(201)

    await api().post('/api/v1/auth/account/delete').set(bearer(accessToken)).send({ password: 'bad' }).expect(400)
    await api().post('/api/v1/auth/account/delete').set(bearer(accessToken)).send({ password: PASSWORD }).expect(204)
    await api()
      .post('/api/v1/auth/account/delete/confirm')
      .send({ token: testApp.emails.tokenFor('alice@example.com') })
      .expect(204)

    const user = await database.client.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user).toMatchObject({ name: 'Deleted player', email: `deleted-${userId}@deleted.invalid` })
    expect(user.deletedAt).not.toBeNull()
    expect(await database.client.localCredential.count()).toBe(0)
    expect(await database.client.session.count()).toBe(0)
    expect(await database.client.bot.findUnique({ where: { id: base.body.bot._id } })).not.toBeNull()
    await api().get('/api/v1/users/me').set(bearer(accessToken)).expect(401)
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com', password: PASSWORD }).expect(401)
  })

  it('refuses to refresh without a cookie', async () => {
    await api().post('/api/v1/auth/refresh').expect(401)
    await api().post('/api/v1/auth/logout').expect(204)
  })

  it('resends the verification link', async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
      .expect(201)
    const first = testApp.emails.tokenFor('alice@example.com')

    await api().post('/api/v1/auth/email/resend').send({ email: 'alice@example.com' }).expect(204)
    const second = testApp.emails.tokenFor('alice@example.com')

    expect(second).not.toBe(first)
    await api().post('/api/v1/auth/email/verify').send({ token: first }).expect(400)
    await api().post('/api/v1/auth/email/verify').send({ token: second }).expect(204)
  })
})

describe('authorization', () => {
  it('denies by default: protected routes need a token, public ones do not', async () => {
    await api().get('/api/v1/users/me').expect(401)
    await api().get('/api/v1/users').expect(401)
    await api().get('/api/v1/health').expect(200)
    await api().get('/api/v1/users/me').set(bearer('garbage')).expect(401)
    await api().get('/api/v1/users/me').set({ Authorization: 'Basic abc' }).expect(401)
  })

  it('keeps a regular player out of the admin routes', async () => {
    const { userId, accessToken } = await signUp('alice@example.com')

    await api().get('/api/v1/users').set(bearer(accessToken)).expect(403)
    await api().put(`/api/v1/users/${userId}`).set(bearer(accessToken)).send({ name: 'Bobby' }).expect(403)
    await api().put(`/api/v1/users/${userId}`).set(bearer(accessToken)).send({ status: 'owner' }).expect(403)
    await api().get('/api/v1/admin/statistics').set(bearer(accessToken)).expect(403)
    expect((await database.client.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe('user')
  })

  it('keeps the settings of the game for admins, and the settings of a player for the player', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com', 'Bob')
    const admin = await signUp('admin@example.com', 'Admin')
    await database.client.user.update({ where: { id: admin.userId }, data: { status: 'admin' } })
    const settings = (token: string) => api().get('/api/v1/settings').set(bearer(token))
    const patch = (token: string, body: object) => api().patch('/api/v1/settings').set(bearer(token)).send(body)

    await api().get('/api/v1/settings').expect(401)
    expect((await settings(alice.accessToken).expect(200)).body).toMatchObject({
      global: { categories: { combat: true } },
      user: { categories: { combat: true }, reducedMotion: null },
      effective: { combat: true }
    })

    const changed = await patch(alice.accessToken, { categories: { combat: false }, reducedMotion: true }).expect(200)
    expect(changed.body.user).toMatchObject({ categories: { combat: false, movement: true }, reducedMotion: true })
    expect((await settings(bob.accessToken).expect(200)).body.user.categories.combat).toBe(true)
    await patch(alice.accessToken, { categories: { flying: true } }).expect(400)
    await patch(alice.accessToken, { categories: { combat: 'no' } }).expect(400)
    await patch(alice.accessToken, { reducedMotion: 'yes' }).expect(400)
    await patch(alice.accessToken, { categories: 5 }).expect(400)
    await patch(alice.accessToken, { reducedMotion: null }).expect(200)

    await api().get('/api/v1/admin/settings').set(bearer(alice.accessToken)).expect(403)
    await api().patch('/api/v1/admin/settings').set(bearer(alice.accessToken)).send({ categories: {} }).expect(403)
    await api()
      .patch('/api/v1/admin/settings')
      .set(bearer(admin.accessToken))
      .send({ categories: { movement: false } })
      .expect(200)
    expect((await api().get('/api/v1/admin/settings').set(bearer(admin.accessToken)).expect(200)).body).toMatchObject({
      categories: { movement: false, combat: true }
    })
    // The game's switch is a ceiling: Bob switches movement on for himself and still cannot use it
    const narrowed = await patch(bob.accessToken, { categories: { movement: true } }).expect(200)
    expect(narrowed.body).toMatchObject({
      global: { categories: { movement: false } },
      user: { categories: { movement: true } },
      effective: { movement: false }
    })
    await api().patch('/api/v1/admin/settings').set(bearer(admin.accessToken)).send({}).expect(400)
  })

  it('lets an admin list and edit regular users but not change a status', async () => {
    const alice = await signUp('alice@example.com')
    const admin = await signUp('admin@example.com', 'Admin')
    await database.client.user.update({ where: { id: admin.userId }, data: { status: 'admin' } })

    const list = await api()
      .get('/api/v1/users?status=user&active=true&results=5')
      .set(bearer(admin.accessToken))
      .expect(200)
    expect(list.body.result.map((u: { _id: string }) => u._id)).toEqual([alice.userId])
    expect(list.body.meta.pagination).toEqual({ page: 1, results: 5, total: 1 })
    expect(JSON.stringify(list.body)).not.toMatch(/hash/i)

    const updated = await api()
      .put(`/api/v1/users/${alice.userId}`)
      .set(bearer(admin.accessToken))
      .send({ name: 'Bobby' })
      .expect(200)
    expect(updated.body.result).toMatchObject({ name: 'Bobby', active: true })
    await api()
      .put(`/api/v1/users/${alice.userId}`)
      .set(bearer(admin.accessToken))
      .send({ status: 'banned' })
      .expect(403)
    await api().put(`/api/v1/users/${alice.userId}`).set(bearer(admin.accessToken)).send({}).expect(400)
    await api().put('/api/v1/users/not-a-uuid').set(bearer(admin.accessToken)).send({ name: 'Bobby' }).expect(400)
    await api().get('/api/v1/users?results=1000').set(bearer(admin.accessToken)).expect(400)

    const stats = await api().get('/api/v1/admin/statistics').set(bearer(admin.accessToken)).expect(200)
    expect(stats.body.usersByStatus).toMatchObject({ admin: 1, user: 1 })
  })

  it('lets an owner ban a player, which takes effect on the very next request', async () => {
    const alice = await signUp('alice@example.com')
    const owner = await signUp('owner@example.com', 'Owner')
    await database.client.user.update({ where: { id: owner.userId }, data: { status: 'owner' } })

    await api()
      .put(`/api/v1/users/${alice.userId}`)
      .set(bearer(owner.accessToken))
      .send({ status: 'banned' })
      .expect(200)

    expect((await api().get('/api/v1/users/me').set(bearer(alice.accessToken)).expect(403)).body.code).toBe(
      'USER_BANNED'
    )
    await api().post('/api/v1/auth/refresh').set('Cookie', alice.cookie).expect(403)
    await api().post('/api/v1/auth/login').send({ email: 'alice@example.com', password: PASSWORD }).expect(403)
  })

  it('reads the role from the store: a promotion or demotion applies without a new token', async () => {
    const { userId, accessToken } = await signUp('alice@example.com')

    await database.client.user.update({ where: { id: userId }, data: { status: 'admin' } })
    await api().get('/api/v1/users').set(bearer(accessToken)).expect(200)

    await database.client.user.update({ where: { id: userId }, data: { status: 'user' } })
    await api().get('/api/v1/users').set(bearer(accessToken)).expect(403)
  })
})

describe('game flows (bots over HTTP and Socket.IO)', () => {
  it('rejects the bot routes without a valid token and for unverified users', async () => {
    await api().post('/api/v1/bots/base').expect(401)

    const registered = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
      .expect(201)
    await api()
      .post('/api/v1/bots/base')
      .set(bearer(registered.body.accessToken))
      .send({ password: 'secret1' })
      .expect(403)
  })

  it('deploys a base once and scans around it', async () => {
    const { userId, accessToken } = await signUp('alice@example.com')

    await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({}).expect(400)
    await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'short' }).expect(400)
    expect(await database.client.bot.count()).toBe(0)

    const deployed = await api()
      .post('/api/v1/bots/base')
      .set(bearer(accessToken))
      .send({ password: 'secret1' })
      .expect(201)
    const botId = deployed.body.bot._id
    expect(deployed.body.bot).toMatchObject({ userId, type: 'base' })
    expect(JSON.stringify(deployed.body)).not.toContain('secret1')
    expect(deployed.body.bot.passwordHash).toBeUndefined()
    const stored = await database.client.bot.findUniqueOrThrow({ where: { id: botId } })
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(deployed.body.modules).toHaveLength(10)
    expect(await database.client.module.count({ where: { botId } })).toBe(10)

    await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' }).expect(403)

    const scan = await api().post(`/api/v1/bots/${botId}/scan`).set(bearer(accessToken)).expect(200)
    expect(scan.body).toHaveLength(9)
    expect(await database.client.knownPoint.count({ where: { userId } })).toBe(9)

    const bots = await api().get('/api/v1/bots').set(bearer(accessToken)).expect(200)
    expect(bots.body).toEqual([expect.objectContaining({ _id: botId, type: 'base', userId })])
    expect((await api().get('/api/v1/bots?type=base').set(bearer(accessToken)).expect(200)).body).toHaveLength(1)
    expect((await api().get('/api/v1/bots?type=worker').set(bearer(accessToken)).expect(200)).body).toHaveLength(0)
    await api().get('/api/v1/bots?type=tank').set(bearer(accessToken)).expect(400)

    const modules = await api().get(`/api/v1/bots/${botId}/modules`).set(bearer(accessToken)).expect(200)
    expect(modules.body).toHaveLength(10)
    expect(modules.body).toContainEqual(expect.objectContaining({ botId, type: 'scanner', distance: 1 }))
    await api().get('/api/v1/bots/not-an-id/modules').set(bearer(accessToken)).expect(400)
    await api().get('/api/v1/bots/0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e/modules').set(bearer(accessToken)).expect(404)

    expect((await api().get(`/api/v1/bots/${botId}/bots`).set(bearer(accessToken)).expect(200)).body).toEqual([])
    await api().get('/api/v1/bots/not-an-id/bots').set(bearer(accessToken)).expect(400)

    const stranger = await signUp('bob@example.com', 'Bob')
    await api().get(`/api/v1/bots/${botId}/bots`).set(bearer(stranger.accessToken)).expect(403)
    await api().get(`/api/v1/bots/${botId}/modules`).set(bearer(stranger.accessToken)).expect(403)
    await api().post(`/api/v1/bots/${botId}/scan`).set(bearer(stranger.accessToken)).expect(403)
    await api().post('/api/v1/bots/not-an-id/scan').set(bearer(accessToken)).expect(400)
  })

  it('lets a player whose base was lost deploy a new one, and leaves the old base as a corpse', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const deploy = () => api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' })
    const oldId = (await deploy().expect(201)).body.bot._id
    await database.client.module.updateMany({
      where: { botId: oldId, type: 'wirelessAdapter' },
      data: { condition: 0 }
    })

    expect((await api().get('/api/v1/bots?type=base').set(bearer(accessToken)).expect(200)).body).toEqual([])
    const lost = await api().get(`/api/v1/bots/${oldId}/bots`).set(bearer(accessToken)).expect(403)
    expect(lost.body.code).toBe('BASE_LOST')

    const newId = (await deploy().expect(201)).body.bot._id
    expect(newId).not.toBe(oldId)
    await deploy().expect(403)

    const points = await database.client.mapPoint.findMany({ where: { contentId: { in: [oldId, newId] } } })
    expect(Object.fromEntries(points.map((p) => [p.contentId, p.type]))).toEqual({
      [oldId]: 'corpse_base',
      [newId]: 'base'
    })
    expect((await api().get('/api/v1/bots?type=base').set(bearer(accessToken)).expect(200)).body).toHaveLength(1)
  })

  it('starts players with the same spawn seed near each other and keeps strangers away', async () => {
    const [alice, bob, carol] = [
      await signUp('alice@example.com'),
      await signUp('bob@example.com', 'Bob'),
      await signUp('carol@example.com', 'Carol')
    ]
    const deploy = (player: { accessToken: string }, body: object) =>
      api()
        .post('/api/v1/bots/base')
        .set(bearer(player.accessToken))
        .send({ password: 'secret1', ...body })
    const where = async (response: { body: { mapPoint: { location: { x: number; y: number } } } }) =>
      response.body.mapPoint.location

    await deploy(alice, { spawnSeed: 'x' }).expect(400)
    const first = await where(await deploy(alice, { spawnSeed: 'ALPHA-7K2' }).expect(201))
    const second = await where(await deploy(bob, { spawnSeed: 'alpha-7k2' }).expect(201))
    const stranger = await where(await deploy(carol, {}).expect(201))

    const chebyshev = (a: typeof first, b: typeof first) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
    expect(chebyshev(first, second)).toBeLessThanOrEqual(12)
    expect(chebyshev(first, stranger)).toBeGreaterThanOrEqual(30)
    expect(chebyshev(second, stranger)).toBeGreaterThanOrEqual(30)
    expect(await database.client.spawnSeedMember.count({ where: { seedCode: 'ALPHA-7K2' } })).toBe(2)
  })

  it('manages the files of a drive over HTTP', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const botId = (
      await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' }).expect(201)
    ).body.bot._id
    const drive = await database.client.module.findFirstOrThrow({ where: { botId, type: 'drive' } })
    await database.client.module.update({ where: { id: drive.id }, data: { props: { quota: 30 } } })
    const drives = `/api/v1/bots/${botId}/drives`
    const files = `${drives}/${drive.id}`

    expect((await api().get(drives).set(bearer(accessToken)).expect(200)).body).toEqual([
      { _id: drive.id, botId, name: 'memory-class1', quota: 30, used: 0 }
    ])

    await api().post(`${files}/directories`).set(bearer(accessToken)).send({ path: 'scripts' }).expect(201)
    await api().post(`${files}/directories`).set(bearer(accessToken)).send({ path: 'scripts' }).expect(409)
    const written = await api()
      .put(`${files}/file`)
      .set(bearer(accessToken))
      .send({ path: 'scripts/mine.js', content: 'mine()' })
      .expect(200)
    expect(written.body).toMatchObject({ path: 'scripts/mine.js', kind: 'file', size: 6 })
    expect(written.body.content).toBeUndefined()

    const read = await api()
      .get(`${files}/file`)
      .query({ path: 'scripts/mine.js' })
      .set(bearer(accessToken))
      .expect(200)
    expect(read.body.content).toBe('mine()')
    const listed = await api()
      .get(`${files}/files`)
      .query({ directory: 'scripts' })
      .set(bearer(accessToken))
      .expect(200)
    expect(listed.body).toEqual([expect.objectContaining({ path: 'scripts/mine.js' })])

    await api()
      .put(`${files}/file`)
      .set(bearer(accessToken))
      .send({ path: 'big.txt', content: 'x'.repeat(30) })
      .expect(413)
    await api().put(`${files}/file`).set(bearer(accessToken)).send({ path: 'bad.exe', content: '' }).expect(400)
    await api().put(`${files}/file`).set(bearer(accessToken)).send({ path: 'a.js' }).expect(400)
    await api().get(`${files}/file`).query({ path: 'none.js' }).set(bearer(accessToken)).expect(404)
    await api().get(`${drives}/not-an-id/files`).set(bearer(accessToken)).expect(400)

    const stranger = await signUp('bob@example.com', 'Bob')
    await api().get(drives).set(bearer(stranger.accessToken)).expect(403)

    await api().delete(`${files}/file`).query({ path: 'scripts' }).set(bearer(accessToken)).expect(400)
    await api().delete(`${files}/file`).query({ path: 'scripts/mine.js' }).set(bearer(accessToken)).expect(204)
    await api().delete(`${files}/file`).query({ path: 'scripts' }).set(bearer(accessToken)).expect(204)
    expect(await database.client.file.count()).toBe(0)
  })

  it('lists the recipes with what the player knows of them', async () => {
    const { accessToken } = await signUp('alice@example.com')
    await api().get('/api/v1/crafting/recipes').expect(401)

    const { body } = await api().get('/api/v1/crafting/recipes').set(bearer(accessToken)).expect(200)

    expect(body.find((r: { module: string }) => r.module === 'scanner-class1')).toMatchObject({
      isKnown: true,
      canResearch: false,
      research: null
    })
    expect(body.find((r: { module: string }) => r.module === 'scanner-class2')).toMatchObject({
      isKnown: false,
      canResearch: true,
      research: { timeMs: 200_000 }
    })
  })

  it('crafts, researches, learns and assembles at the factory of a base over HTTP', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const stranger = await signUp('bob@example.com', 'Bob')
    const { body: deployed } = await api()
      .post('/api/v1/bots/base')
      .set(bearer(accessToken))
      .send({ password: 'secret1' })
      .expect(201)
    const baseId = deployed.bot._id
    const factory = `/api/v1/bots/${baseId}/factory`
    const moduleRow = (type: string) => database.client.module.findFirstOrThrow({ where: { botId: baseId, type } })

    await api().get(factory).expect(401)
    await api().get(`${factory}`).set(bearer(stranger.accessToken)).expect(403)
    await api().get('/api/v1/bots/not-an-id/factory').set(bearer(accessToken)).expect(400)
    expect((await api().get(factory).set(bearer(accessToken)).expect(200)).body).toMatchObject({
      jobs: [],
      parts: [],
      blueprintItems: []
    })

    await api()
      .post(`${factory}/craft`)
      .set(bearer(accessToken))
      .send({ module: 'processor-class1', count: 0 })
      .expect(400)
    await api().post(`${factory}/craft`).set(bearer(accessToken)).send({ module: 'laser' }).expect(404)
    await api().post(`${factory}/craft`).set(bearer(accessToken)).send({ module: 'scanner-class2' }).expect(409)
    expect(
      (await api().post(`${factory}/craft`).set(bearer(accessToken)).send({ module: 'processor-class1' }).expect(409))
        .body.code
    ).toBe('EMPTY')

    const storage = await moduleRow('storage')
    await database.client.module.update({
      where: { id: storage.id },
      data: {
        props: {
          capacity: 2000,
          items: [
            { resource: 'crystal', amount: 400 },
            { resource: 'gold', amount: 100 },
            { resource: 'iron', amount: 500 }
          ]
        }
      }
    })

    for (const module of ['processor-class1', 'wireless-adapter-class1', 'battery-class1']) {
      const crafted = await api().post(`${factory}/craft`).set(bearer(accessToken)).send({ module }).expect(201)
      expect(crafted.body).toEqual([expect.objectContaining({ kind: 'craft', module })])
    }
    expect((await api().get(factory).set(bearer(accessToken)).expect(200)).body.jobs).toHaveLength(3)

    const research = await api()
      .post(`${factory}/research`)
      .set(bearer(accessToken))
      .send({ module: 'scanner-class2' })
      .expect(201)
    expect(research.body).toMatchObject({ kind: 'research', module: 'scanner-class2' })
    await api().post(`${factory}/research`).set(bearer(accessToken)).send({}).expect(400)

    // The factory is done with everything
    const row = await moduleRow('factory')
    const jobs = (row.props as { jobs: object[] }).jobs.map((job) => ({ ...job, readyAt: 1 }))
    await database.client.module.update({ where: { id: row.id }, data: { props: { ...(row.props as object), jobs } } })

    const status = (await api().get(factory).set(bearer(accessToken)).expect(200)).body
    expect(status.jobs).toEqual([])
    expect(status.parts.map((part: { name: string }) => part.name).sort()).toEqual([
      'battery-class1',
      'processor-class1',
      'wireless-adapter-class1'
    ])
    const recipes = await api().get('/api/v1/crafting/recipes').set(bearer(accessToken)).expect(200)
    expect(recipes.body.find((r: { module: string }) => r.module === 'scanner-class2').isKnown).toBe(true)

    const partIds = status.parts.map((part: { _id: string }) => part._id)
    await api().post(`${factory}/assemble`).set(bearer(accessToken)).send({ partIds: [] }).expect(400)
    await api().post(`${factory}/assemble`).set(bearer(stranger.accessToken)).send({ partIds }).expect(403)
    const assembled = await api()
      .post(`${factory}/assemble`)
      .set(bearer(accessToken))
      .send({ label: 'Scout', partIds })
      .expect(201)
    expect(assembled.body.bot).toMatchObject({ label: 'Scout', baseId, type: 'worker' })
    expect(assembled.body.modules).toHaveLength(3)
    expect((await api().get(`/api/v1/bots/${baseId}/bots`).set(bearer(accessToken)).expect(200)).body).toHaveLength(1)
    expect(await database.client.item.count({ where: { botId: baseId } })).toBe(0)

    const blueprint = await database.client.item.create({
      data: {
        id: '0b7b4b0e-7d3a-4f0e-9a52-0f0b9a1c2d3e',
        type: 'blueprint',
        name: 'gun-class2',
        weight: 0.1,
        botId: baseId
      }
    })
    expect((await api().get(factory).set(bearer(accessToken)).expect(200)).body.blueprintItems).toHaveLength(1)
    await api().post(`${factory}/learn`).set(bearer(accessToken)).send({ itemId: 'nope' }).expect(400)
    const learned = await api()
      .post(`${factory}/learn`)
      .set(bearer(accessToken))
      .send({ itemId: blueprint.id })
      .expect(201)
    expect(learned.body).toMatchObject({ module: 'gun-class2', source: 'item' })
    await api().post(`${factory}/learn`).set(bearer(accessToken)).send({ itemId: blueprint.id }).expect(404)
  })

  it('repairs and disassembles a module of a bot on an adjacent cell over HTTP', async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com', 'Bob')
    const deploy = async (token: string) =>
      (await api().post('/api/v1/bots/base').set(bearer(token)).send({ password: 'secret1' }).expect(201)).body
    const [aliceBase, bobBase] = [await deploy(alice.accessToken), await deploy(bob.accessToken)]
    const aliceId: string = aliceBase.bot._id
    const bobId: string = bobBase.bot._id

    // Bob's base next to Alice's, a repair module and iron for Alice
    const at = await database.client.mapPoint.findFirstOrThrow({ where: { contentId: aliceId } })
    await database.client.mapPoint.updateMany({ where: { contentId: bobId }, data: { x: at.x + 1, y: at.y, z: at.z } })
    const repair = await database.client.module.create({
      data: {
        id: randomUUID(),
        botId: aliceId,
        type: 'repair',
        name: 'repair-class1',
        condition: 100,
        maxCondition: 100,
        weight: 25,
        operationCost: 5,
        idleCost: 0,
        props: { repairPerOp: 25, delay: 1000 }
      }
    })
    const storage = await database.client.module.findFirstOrThrow({ where: { botId: aliceId, type: 'storage' } })
    await database.client.module.update({
      where: { id: storage.id },
      data: { props: { capacity: 500, items: [{ resource: 'iron', amount: 100 }] } }
    })
    const gun = await database.client.module.findFirstOrThrow({ where: { botId: bobId, type: 'weapon' } })
    await database.client.module.update({ where: { id: gun.id }, data: { condition: 50 } })

    const maintenance = `/api/v1/bots/${aliceId}/maintenance`
    const order = { targetBotId: bobId, moduleId: gun.id }
    await api().post(`${maintenance}/repair`).send(order).expect(401)
    await api().post(`${maintenance}/repair`).set(bearer(bob.accessToken)).send(order).expect(403)
    await api().post(`${maintenance}/repair`).set(bearer(alice.accessToken)).send({ targetBotId: 'x' }).expect(400)
    await api().post('/api/v1/bots/nope/maintenance/repair').set(bearer(alice.accessToken)).send(order).expect(400)

    const repaired = await api().post(`${maintenance}/repair`).set(bearer(alice.accessToken)).send(order).expect(200)
    expect(repaired.body).toMatchObject({ _id: gun.id, condition: 75 })
    const again = await api().post(`${maintenance}/repair`).set(bearer(alice.accessToken)).send(order).expect(409)
    expect(again.body.code).toBe('COOLDOWN')

    // Bob's gun is broken: anybody may take it apart
    await database.client.module.update({ where: { id: gun.id }, data: { condition: 0 } })
    await database.client.module.update({ where: { id: repair.id }, data: { props: { repairPerOp: 25, delay: 1000 } } })
    const scrap = await api().post(`${maintenance}/disassemble`).set(bearer(alice.accessToken)).send(order).expect(200)
    expect(scrap.body.scrap).toEqual([{ resource: 'iron', amount: expect.any(Number) }])
    expect(scrap.body).toHaveProperty('blueprint')
    expect(await database.client.module.count({ where: { id: gun.id } })).toBe(0)
  })

  it('keeps the parts when there is no free cell next to the base for the new bot', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const { body: deployed } = await api()
      .post('/api/v1/bots/base')
      .set(bearer(accessToken))
      .send({ password: 'secret1' })
      .expect(201)
    const baseId = deployed.bot._id
    const at = deployed.mapPoint.location

    for (const type of ['processor', 'wirelessAdapter', 'battery']) {
      const part = await database.client.item.create({
        data: {
          id: randomUUID(),
          type: 'part',
          name: {
            processor: 'processor-class1',
            wirelessAdapter: 'wireless-adapter-class1',
            battery: 'battery-class1'
          }[type] as string,
          weight: 5,
          botId: baseId
        }
      })
      expect(part.id).toBeDefined()
    }
    // Every cell around the base holds a deposit
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1]
    ]) {
      await database.client.mapPoint.create({
        data: {
          id: randomUUID(),
          x: at.x + dx,
          y: at.y + dy,
          z: at.z ?? 0,
          type: 'resource',
          resource: 'iron',
          amount: 5
        }
      })
    }
    const partIds = (await database.client.item.findMany({ where: { botId: baseId } })).map((item) => item.id)

    const refused = await api()
      .post(`/api/v1/bots/${baseId}/factory/assemble`)
      .set(bearer(accessToken))
      .send({ label: 'Scout', partIds })
      .expect(409)

    expect(refused.body.code).toBe('NO_FREE_LOCATION')
    expect(await database.client.item.count({ where: { botId: baseId } })).toBe(3)
    expect(await database.client.bot.count({ where: { baseId } })).toBe(0)
    expect(await database.client.module.count({ where: { botId: baseId } })).toBe(10)
  })

  it('gives a lost base back to its owner when a bot repairs its wireless adapter', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const deploy = async () =>
      (await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' }).expect(201)).body
    const old = await deploy()
    const oldId: string = old.bot._id
    const adapter = await database.client.module.findFirstOrThrow({ where: { botId: oldId, type: 'wirelessAdapter' } })
    await database.client.module.update({ where: { id: adapter.id }, data: { condition: 0 } })
    await api().get(`/api/v1/bots/${oldId}/bots`).set(bearer(accessToken)).expect(403)

    // A new base next to the old one, with a repair module and the resources for the adapter
    const fresh = await deploy()
    const freshId: string = fresh.bot._id
    const at = await database.client.mapPoint.findFirstOrThrow({ where: { contentId: oldId } })
    await database.client.mapPoint.updateMany({
      where: { contentId: freshId },
      data: { x: at.x + 1, y: at.y, z: at.z }
    })
    const repair = await database.client.module.create({
      data: {
        id: randomUUID(),
        botId: freshId,
        type: 'repair',
        name: 'repair-class1',
        condition: 100,
        maxCondition: 100,
        weight: 25,
        operationCost: 5,
        idleCost: 0,
        props: { repairPerOp: 25, delay: 1000 }
      }
    })
    const storage = await database.client.module.findFirstOrThrow({ where: { botId: freshId, type: 'storage' } })
    await database.client.module.update({
      where: { id: storage.id },
      data: {
        props: {
          capacity: 500,
          items: [
            { resource: 'crystal', amount: 50 },
            { resource: 'gold', amount: 50 }
          ]
        }
      }
    })

    for (let step = 0; step < 4; step++) {
      await database.client.module.update({
        where: { id: repair.id },
        data: { props: { repairPerOp: 25, delay: 1000 } }
      })
      await api()
        .post(`/api/v1/bots/${freshId}/maintenance/repair`)
        .set(bearer(accessToken))
        .send({ targetBotId: oldId, moduleId: adapter.id })
        .expect(200)
    }

    expect((await database.client.module.findUniqueOrThrow({ where: { id: adapter.id } })).condition).toBe(100)
    expect((await database.client.mapPoint.findFirstOrThrow({ where: { contentId: oldId } })).type).toBe('base')
    await api().get(`/api/v1/bots/${oldId}/bots`).set(bearer(accessToken)).expect(200)
    expect((await api().get('/api/v1/bots?type=base').set(bearer(accessToken)).expect(200)).body).toHaveLength(2)
  })

  it("serves the player's own map with fog of war over HTTP", async () => {
    const alice = await signUp('alice@example.com')
    const bob = await signUp('bob@example.com', 'Bob')
    const deploy = async (accessToken: string) =>
      (await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' }).expect(201)).body
    const base = await deploy(alice.accessToken)
    await deploy(bob.accessToken)
    const { x, y } = base.mapPoint.location
    const range = `minX=${x - 20}&minY=${y - 20}&maxX=${x + 20}&maxY=${y + 20}`
    const mapOf = (token: string, query = range) => api().get(`/api/v1/map?${query}`).set(bearer(token))

    await api().get(`/api/v1/map?${range}`).expect(401)
    expect((await mapOf(alice.accessToken).expect(200)).body.cells).toEqual([
      expect.objectContaining({ x, y, type: 'base', contentId: base.bot._id, isOwn: true })
    ])

    await api().post(`/api/v1/bots/${base.bot._id}/scan`).set(bearer(alice.accessToken)).expect(200)
    const view = (await mapOf(alice.accessToken).expect(200)).body
    expect(view.cells).toHaveLength(9)
    expect(view.liveAreas).toEqual([])
    expect(view.now).toEqual(expect.any(Number))
    expect(view.cells.find((cell: { x: number; y: number }) => cell.x === x && cell.y === y)).toMatchObject({
      isOwn: true
    })
    expect(
      (await mapOf(bob.accessToken).expect(200)).body.cells.every(
        (cell: { contentId: string }) => cell.contentId !== base.bot._id
      )
    ).toBe(true)

    const position = (token: string, id: string) => api().get(`/api/v1/map/bots/${id}`).set(bearer(token))
    expect((await position(alice.accessToken, base.bot._id).expect(200)).body).toEqual({ x, y })
    await position(bob.accessToken, base.bot._id).expect(404)
    await position(alice.accessToken, 'not-an-id').expect(400)

    await mapOf(alice.accessToken, 'minX=0&minY=0&maxX=500&maxY=5').expect(400)
    await mapOf(alice.accessToken, 'minX=a&minY=0&maxX=5&maxY=5').expect(400)
    await mapOf(alice.accessToken, 'minX=5&minY=0&maxX=1&maxY=5').expect(400)
  })

  describe('Socket.IO', () => {
    const open = (token: unknown) =>
      new Promise<Socket>((resolve, reject) => {
        const socket = connect(testApp.url, { auth: { token }, reconnection: false, transports: ['websocket'] })
        socket.on('connect', () => resolve(socket))
        socket.on('connect_error', (error) => {
          socket.close()
          reject(error)
        })
      })

    const emit = (socket: Socket, event: string, ...args: unknown[]) =>
      new Promise<unknown[]>((resolve) => socket.emit(event, ...args, (...ack: unknown[]) => resolve(ack)))

    it('serves get-user-bases, get-user-bots and get-bot-modules to the owner only', async () => {
      const { accessToken } = await signUp('alice@example.com')
      const deployed = await api()
        .post('/api/v1/bots/base')
        .set(bearer(accessToken))
        .send({ password: 'secret1' })
        .expect(201)
      const botId = deployed.body.bot._id
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]

      try {
        expect(await emit(alice, 'get-user-bases')).toEqual([[expect.objectContaining({ _id: botId })]])
        expect(await emit(alice, 'get-user-bots')).toEqual([[expect.objectContaining({ _id: botId })]])
        expect((await emit(alice, 'get-bot-modules', botId))[0]).toHaveLength(10)
        expect(await emit(bob, 'get-user-bots')).toEqual([[]])
        expect((await emit(bob, 'get-bot-modules', botId))[1]).toMatchObject({ code: 403 })
        expect((await emit(alice, 'get-bot-modules', { $ne: 1 }))[1]).toMatchObject({ code: 400 })
      } finally {
        alice.close()
        bob.close()
      }
    })

    it('serves get-map to the owner, with the same fog of war', async () => {
      const { accessToken } = await signUp('alice@example.com')
      const deployed = await api()
        .post('/api/v1/bots/base')
        .set(bearer(accessToken))
        .send({ password: 'secret1' })
        .expect(201)
      const { x, y } = deployed.body.mapPoint.location
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]
      const range = { minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5 }

      try {
        const [view] = (await emit(alice, 'get-map', range)) as [{ cells: unknown[] }]
        expect(view.cells).toEqual([expect.objectContaining({ x, y, isOwn: true })])
        expect(((await emit(bob, 'get-map', range))[0] as { cells: unknown[] }).cells).toEqual([])
        expect((await emit(alice, 'get-map', { ...range, maxX: x + 500 }))[1]).toMatchObject({ code: 400 })
        expect((await emit(alice, 'get-map', 'nope'))[1]).toMatchObject({ code: 400 })
      } finally {
        alice.close()
        bob.close()
      }
    })

    it('serves the factory events to the owner of the base only', async () => {
      const { accessToken } = await signUp('alice@example.com')
      const deployed = await api()
        .post('/api/v1/bots/base')
        .set(bearer(accessToken))
        .send({ password: 'secret1' })
        .expect(201)
      const baseId = deployed.body.bot._id
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]

      try {
        expect(await emit(alice, 'get-factory', baseId)).toEqual([
          expect.objectContaining({ jobs: [], parts: [], blueprintItems: [] })
        ])
        expect((await emit(alice, 'craft-module', baseId, 'wheels-class1'))[1]).toMatchObject({ code: 409 })
        expect((await emit(bob, 'get-factory', baseId))[1]).toMatchObject({ code: 403 })
        expect((await emit(alice, 'get-factory', 'nope'))[1]).toMatchObject({ code: 400 })
      } finally {
        alice.close()
        bob.close()
      }
    })

    it('stores terminal sessions and their history for the owner of the bot', async () => {
      const { userId, accessToken } = await signUp('alice@example.com')
      const botId = (
        await api().post('/api/v1/bots/base').set(bearer(accessToken)).send({ password: 'secret1' }).expect(201)
      ).body.bot._id
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]

      try {
        const [session] = (await emit(alice, 'open-terminal', botId)) as [{ _id: string }]
        expect(await database.client.terminalSession.count({ where: { botId, userId, endedAt: null } })).toBe(1)
        expect((await emit(bob, 'open-terminal', botId))[1]).toMatchObject({ code: 403 })
        expect(await emit(alice, 'get-terminal-history', botId, 10)).toEqual([[]])

        const [listed] = (await emit(alice, 'terminal-command', session._id, 'list')) as [
          { result: { lines: string[] } }
        ]
        expect(listed.result.lines).toEqual([expect.stringContaining(`(current) id="${botId}"`)])
        expect((await emit(alice, 'terminal-command', session._id, 'nonsense'))[0]).toMatchObject({
          result: { type: 'error', code: 'UNKNOWN_COMMAND' }
        })
        expect(await database.client.terminalLog.count({ where: { botId, sessionId: session._id } })).toBe(4)
        expect((await emit(bob, 'terminal-command', session._id, 'list'))[1]).toMatchObject({ code: 403 })

        alice.close()
        const closedSessions = () =>
          database.client.terminalSession.count({ where: { id: session._id, endedAt: { not: null } } })
        for (let attempt = 0; attempt < 50 && !(await closedSessions()); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        expect(await closedSessions()).toBe(1)
      } finally {
        alice.close()
        bob.close()
      }
    })

    it('rejects the handshake of missing, invalid, banned and logged-out users', async () => {
      const { userId, accessToken, cookie } = await signUp('alice@example.com')

      await expect(open(undefined)).rejects.toThrow('Unauthorized')
      await expect(open('garbage')).rejects.toThrow('Unauthorized')

      await api().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204)
      await expect(open(accessToken)).rejects.toThrow('Unauthorized')

      const fresh = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com', password: PASSWORD })
        .expect(200)
      await database.client.user.update({ where: { id: userId }, data: { status: 'banned' } })
      await expect(open(fresh.body.accessToken)).rejects.toThrow('Unauthorized')
    })
  })
})
