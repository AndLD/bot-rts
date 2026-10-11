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
    const base = await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(201)

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
    await api().post('/api/v1/bots/base').set(bearer(registered.body.accessToken)).expect(403)
  })

  it('deploys a base once and scans around it', async () => {
    const { userId, accessToken } = await signUp('alice@example.com')

    const deployed = await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(201)
    const botId = deployed.body.bot._id
    expect(deployed.body.bot).toMatchObject({ userId, type: 'base' })
    expect(deployed.body.modules).toHaveLength(7)
    expect(await database.client.module.count({ where: { botId } })).toBe(7)

    await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(403)

    const scan = await api().post(`/api/v1/bots/${botId}/scan`).set(bearer(accessToken)).expect(200)
    expect(scan.body).toHaveLength(9)
    expect(await database.client.knownPoint.count({ where: { userId } })).toBe(9)

    const bots = await api().get('/api/v1/bots').set(bearer(accessToken)).expect(200)
    expect(bots.body).toEqual([expect.objectContaining({ _id: botId, type: 'base', userId })])
    expect((await api().get('/api/v1/bots?type=base').set(bearer(accessToken)).expect(200)).body).toHaveLength(1)
    expect((await api().get('/api/v1/bots?type=worker').set(bearer(accessToken)).expect(200)).body).toHaveLength(0)
    await api().get('/api/v1/bots?type=tank').set(bearer(accessToken)).expect(400)

    const modules = await api().get(`/api/v1/bots/${botId}/modules`).set(bearer(accessToken)).expect(200)
    expect(modules.body).toHaveLength(7)
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

  it('manages the files of a drive over HTTP', async () => {
    const { accessToken } = await signUp('alice@example.com')
    const botId = (await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(201)).body.bot._id
    const drive = await database.client.module.create({
      data: {
        id: randomUUID(),
        botId,
        type: 'drive',
        name: 'memory-class1',
        condition: 100,
        maxCondition: 100,
        weight: 1,
        operationCost: 0,
        idleCost: 0,
        props: { quota: 30 }
      }
    })
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
      const deployed = await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(201)
      const botId = deployed.body.bot._id
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]

      try {
        expect(await emit(alice, 'get-user-bases')).toEqual([[expect.objectContaining({ _id: botId })]])
        expect(await emit(alice, 'get-user-bots')).toEqual([[expect.objectContaining({ _id: botId })]])
        expect((await emit(alice, 'get-bot-modules', botId))[0]).toHaveLength(7)
        expect(await emit(bob, 'get-user-bots')).toEqual([[]])
        expect((await emit(bob, 'get-bot-modules', botId))[1]).toMatchObject({ code: 403 })
        expect((await emit(alice, 'get-bot-modules', { $ne: 1 }))[1]).toMatchObject({ code: 400 })
      } finally {
        alice.close()
        bob.close()
      }
    })

    it('stores terminal sessions and their history for the owner of the bot', async () => {
      const { userId, accessToken } = await signUp('alice@example.com')
      const botId = (await api().post('/api/v1/bots/base').set(bearer(accessToken)).expect(201)).body.bot._id
      const stranger = await signUp('bob@example.com', 'Bob')
      const [alice, bob] = [await open(accessToken), await open(stranger.accessToken)]

      try {
        const [session] = (await emit(alice, 'open-terminal', botId)) as [{ _id: string }]
        expect(await database.client.terminalSession.count({ where: { botId, userId, endedAt: null } })).toBe(1)
        expect((await emit(bob, 'open-terminal', botId))[1]).toMatchObject({ code: 403 })
        expect(await emit(alice, 'get-terminal-history', botId, 10)).toEqual([[]])

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
