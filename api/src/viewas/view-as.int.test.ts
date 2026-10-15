import request from 'supertest'
import { io as connect, Socket } from 'socket.io-client'
import { signUpAdmin } from '../../tests/integration/admin'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let counter = 0

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
const api = () => request(testApp.url)

async function player(): Promise<SignedUp> {
  counter += 1
  return signUpVerified(testApp, database, `viewed${counter}@example.com`, `Viewed${counter}`)
}

const start = (who: SignedUp, target: SignedUp, reason = 'Checking a support ticket') =>
  api().post(`/api/v1/admin/players/${target.userId}/view-as`).set(bearer(who.accessToken)).send({ reason })

const auditOf = (action: string, targetId: string) =>
  database.client.adminAuditEntry.findMany({ where: { action, targetId } })

describe('starting a view', () => {
  it('gives a read-only token for the player, and audits the start', async () => {
    const target = await player()
    const started = await start(admin, target).expect(201)

    expect(started.body.player).toEqual({ _id: target.userId, name: expect.stringContaining('Viewed') })
    expect(started.body.expiresAt).toBeGreaterThan(Date.now())
    const viewer = started.body.accessToken as string

    const me = await api().get('/api/v1/users/me').set(bearer(viewer)).expect(200)
    expect(me.body.email).toBe(target.email)
    const bases = await api().get('/api/v1/bots?type=base').set(bearer(viewer)).expect(200)
    expect(Array.isArray(bases.body)).toBe(true)

    const [entry] = await auditOf('players.view-as.start', target.userId)
    expect(entry).toMatchObject({ actorId: admin.userId, outcome: 'success', reason: 'Checking a support ticket' })
  })

  it('is for owners and admins, on a lower rank, never on oneself, and needs a reason', async () => {
    const target = await player()

    await start(moderator, target).expect(403)
    await start(admin, admin).expect(403)
    await start(admin, owner).expect(403)
    await start(owner, admin).expect(201)
    await api()
      .post(`/api/v1/admin/players/${target.userId}/view-as`)
      .set(bearer(admin.accessToken))
      .send({ reason: 'x' })
      .expect(400)
    await api()
      .post(`/api/v1/admin/players/${target.userId}/view-as`)
      .set(bearer(target.accessToken))
      .send({ reason: 'Because' })
      .expect(403)
    await api()
      .post('/api/v1/admin/players/not-an-id/view-as')
      .set(bearer(admin.accessToken))
      .send({ reason: 'Bad id' })
      .expect(400)
    await api()
      .post('/api/v1/admin/players/2d5c1f3a-0000-4000-8000-000000000000/view-as')
      .set(bearer(admin.accessToken))
      .send({ reason: 'Nobody there' })
      .expect(404)
  })
})

describe('inside a view', () => {
  let target: SignedUp
  let viewer: string

  beforeAll(async () => {
    target = await player()
    viewer = (await start(admin, target).expect(201)).body.accessToken
  })

  it('refuses every request that changes something', async () => {
    const refused = await api().post('/api/v1/bots/base').set(bearer(viewer)).send({}).expect(403)
    expect(refused.body.code).toBe('VIEW_AS_READ_ONLY')

    await api().patch('/api/v1/settings').set(bearer(viewer)).send({}).expect(403)
    await api().post('/api/v1/auth/password/change').set(bearer(viewer)).send({}).expect(403)
  })

  it('never opens the console, whoever the player is', async () => {
    const refused = await api().get('/api/v1/admin/me').set(bearer(viewer)).expect(403)
    expect(refused.body.code).toBe('VIEW_AS_READ_ONLY')
    await api().get('/api/v1/admin/players').set(bearer(viewer)).expect(403)
  })

  it('answers sockets with the player’s data and refuses the commands', async () => {
    const socket: Socket = await new Promise((resolve, reject) => {
      const opened = connect(testApp.url, { auth: { token: viewer }, reconnection: false, transports: ['websocket'] })
      opened.on('connect', () => resolve(opened))
      opened.on('connect_error', reject)
    })
    const ask = (event: string, ...args: unknown[]) =>
      new Promise<[unknown, { code: number; msg: string } | undefined]>((resolve) =>
        socket.emit(event, ...args, (result: unknown, error?: { code: number; msg: string }) =>
          resolve([result, error])
        )
      )

    try {
      const [bases, error] = await ask('get-user-bases')
      expect(error).toBeUndefined()
      expect(Array.isArray(bases)).toBe(true)
      for (const event of ['craft-module', 'open-terminal', 'terminal-command']) {
        const [, refused] = await ask(event, 'x', 'y', 1)
        expect(refused).toMatchObject({ code: 403 })
      }
      const [, unknown] = await ask('something-else')
      expect(unknown).toMatchObject({ code: 403 })

      const botId = '5b0c4c1e-0000-4000-8000-000000000001'
      await ask('get-terminal-history', botId, 10)
      const entries = await auditOf('view-as.terminal.history', target.userId)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ actorId: admin.userId, reason: botId })
    } finally {
      socket.close()
    }
  })

  it('audits a read of the terminal history over HTTP with the admin as the actor', async () => {
    const botId = '5b0c4c1e-0000-4000-8000-000000000002'
    await api().get(`/api/v1/bots/${botId}/terminal-history?limit=5`).set(bearer(viewer))

    const entries = await database.client.adminAuditEntry.findMany({
      where: { action: 'view-as.terminal.history', targetId: target.userId }
    })
    expect(entries.some((entry) => entry.reason?.includes(botId) && entry.actorId === admin.userId)).toBe(true)
  })

  it('does not touch the session of the admin, and ends with an exit', async () => {
    await api().get('/api/v1/admin/me').set(bearer(admin.accessToken)).expect(200)

    await api().post('/api/v1/view-as/exit').set(bearer(admin.accessToken)).expect(403)
    await api().post('/api/v1/view-as/exit').set(bearer(viewer)).expect(204)

    await api().get('/api/v1/users/me').set(bearer(viewer)).expect(401)
    const [entry] = await auditOf('players.view-as.end', target.userId)
    expect(entry).toMatchObject({ actorId: admin.userId, outcome: 'success' })
    await api().get('/api/v1/admin/me').set(bearer(admin.accessToken)).expect(200)
  })

  it('ends when the admin loses the permission, and at its time limit', async () => {
    const other = await player()
    const demoted = (await start(admin, other).expect(201)).body.accessToken as string
    await api().get('/api/v1/users/me').set(bearer(demoted)).expect(200)

    await database.client.user.update({ where: { id: admin.userId }, data: { status: 'moderator' } })
    await api().get('/api/v1/users/me').set(bearer(demoted)).expect(401)
    await database.client.user.update({ where: { id: admin.userId }, data: { status: 'admin' } })

    const timed = (await start(admin, other).expect(201)).body.accessToken as string
    await api().get('/api/v1/users/me').set(bearer(timed)).expect(200)
    await database.client.session.updateMany({
      where: { userId: admin.userId, viewAsUserId: other.userId },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })
    await api().get('/api/v1/users/me').set(bearer(timed)).expect(401)
  })
})
