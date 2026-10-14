import { randomUUID } from 'crypto'
import request from 'supertest'
import { signUpAdmin } from '../../tests/integration/admin'
import { buildBase, buildModule } from '../../tests/integration/builders'
import { createTestDatabase, TestDatabase } from '../../tests/integration/test-database'
import { PASSWORD, signUpVerified, SignedUp, startTestApp, TestApp } from '../../tests/integration/test-app'
import { PrismaPlayerDirectory } from './infrastructure/prisma-player-directory'
import { PrismaBotRepository } from '../bots/infrastructure/prisma-bot.repository'
import { PrismaModuleRepository } from '../modules/infrastructure/prisma-module.repository'
import { PlayersService } from './application/players.service'
import { PLAYERS_SERVICE } from './presentation/players.controller'

let database: TestDatabase
let testApp: TestApp
let owner: SignedUp
let admin: SignedUp
let moderator: SignedUp
let analyst: SignedUp
let counter = 0

beforeAll(async () => {
  database = await createTestDatabase()
  testApp = await startTestApp(database, { RATE_LIMIT_API_MAX: '100000' })
  owner = await signUpAdmin(testApp, database, 'owner')
  admin = await signUpAdmin(testApp, database, 'admin')
  moderator = await signUpAdmin(testApp, database, 'moderator')
  analyst = await signUpAdmin(testApp, database, 'analyst')
})
afterAll(async () => {
  await testApp.close()
  await database.drop()
})

const bearer = (who: SignedUp) => ({ Authorization: `Bearer ${who.accessToken}` })
const api = () => request(testApp.url)

async function player(name = 'Player'): Promise<SignedUp> {
  counter += 1
  return signUpVerified(testApp, database, `player${counter}@example.com`, `${name}${counter}`)
}

const auditOf = (action: string, targetId: string) =>
  database.client.adminAuditEntry.findFirstOrThrow({ where: { action, targetId } })

describe('searching players', () => {
  it('finds by a part of the name or email, filters by status and verification, sorts and pages', async () => {
    const alpha = await player('Alpha')
    await player('Beta')
    await database.client.localCredential.update({ where: { userId: alpha.userId }, data: { emailVerified: false } })

    const byName = await api().get('/api/v1/admin/players?q=alph').set(bearer(moderator)).expect(200)
    expect(byName.body.result.map((p: { _id: string }) => p._id)).toEqual([alpha.userId])
    expect(byName.body.result[0]).toMatchObject({ email: alpha.email, status: 'user', isEmailVerified: false })

    const byId = await api().get(`/api/v1/admin/players?q=${alpha.userId}`).set(bearer(moderator)).expect(200)
    expect(byId.body.meta.pagination.total).toBe(1)

    const unverified = await api().get('/api/v1/admin/players?isEmailVerified=false').set(bearer(moderator)).expect(200)
    expect(unverified.body.result.map((p: { _id: string }) => p._id)).toContain(alpha.userId)
    expect(unverified.body.result.every((p: { isEmailVerified: boolean }) => !p.isEmailVerified)).toBe(true)

    const admins = await api().get('/api/v1/admin/players?status=admin').set(bearer(moderator)).expect(200)
    expect(admins.body.result.map((p: { _id: string }) => p._id)).toEqual([admin.userId])

    const paged = await api()
      .get('/api/v1/admin/players?sort=name&order=asc&results=2&page=2')
      .set(bearer(moderator))
      .expect(200)
    expect(paged.body.result).toHaveLength(2)
    expect(paged.body.meta.pagination).toMatchObject({ page: 2, results: 2 })

    const recent = await api()
      .get('/api/v1/admin/players?registeredFrom=2999-01-01T00:00:00Z')
      .set(bearer(moderator))
      .expect(200)
    expect(recent.body.result).toEqual([])
    await api().get('/api/v1/admin/players?results=1000').set(bearer(moderator)).expect(400)
    await api().get('/api/v1/admin/players?sort=password').set(bearer(moderator)).expect(400)
  })

  it('is for roles with the permission only', async () => {
    await api().get('/api/v1/admin/players').set(bearer(analyst)).expect(403)
    const plain = await player()
    await api().get('/api/v1/admin/players').set(bearer(plain)).expect(403)
  })
})

describe('the profile', () => {
  it('shows sessions, bases, bots, resources, notes and the timeline', async () => {
    const target = await player()
    const base = buildBase(target.userId)
    await new PrismaBotRepository(database.client).add(base)
    await new PrismaBotRepository(database.client).add({
      ...buildBase(target.userId),
      type: 'worker',
      userId: null,
      baseId: base.id
    } as never)
    await new PrismaModuleRepository(database.client).addMany([
      buildModule(base.id, {
        type: 'storage',
        props: { capacity: 100, items: [{ resource: 'iron', amount: 9 }] }
      })
    ])
    await api()
      .post(`/api/v1/admin/players/${target.userId}/notes`)
      .set(bearer(moderator))
      .send({ text: 'friendly' })
      .expect(201)

    const profile = await api().get(`/api/v1/admin/players/${target.userId}`).set(bearer(moderator)).expect(200)

    expect(profile.body).toMatchObject({
      _id: target.userId,
      isDeleted: false,
      botCount: 1,
      resources: [{ resource: 'iron', amount: 9 }],
      runningExecutions: 0,
      activeBan: null
    })
    expect(profile.body.bases).toEqual([{ _id: base.id, label: 'base', botCount: 1 }])
    expect(profile.body.sessions[0]).toMatchObject({ isActive: true })
    expect(profile.body.notes[0]).toMatchObject({ text: 'friendly', authorId: moderator.userId })
    expect(profile.body.timeline.map((entry: { kind: string }) => entry.kind)).toEqual(
      expect.arrayContaining(['registered', 'login', 'admin-action'])
    )
    await api().get(`/api/v1/admin/players/${randomUUID()}`).set(bearer(moderator)).expect(404)
    await api().get('/api/v1/admin/players/not-a-uuid').set(bearer(moderator)).expect(400)
  })
})

describe('banning', () => {
  it('cuts the player off at once, audits the reason, and an unban lets them back in', async () => {
    const target = await player()
    await api().get('/api/v1/users/me').set(bearer(target)).expect(200)

    await api()
      .post(`/api/v1/admin/players/${target.userId}/ban`)
      .set(bearer(moderator))
      .send({ reason: 'spamming chat', durationHours: 24 })
      .expect(204)

    // The sessions ended with the ban, and signing in again is refused
    await api().get('/api/v1/users/me').set(bearer(target)).expect(401)
    await api().post('/api/v1/auth/login').send({ email: target.email, password: PASSWORD }).expect(403)
    const entry = await auditOf('players.ban', target.userId)
    expect(entry).toMatchObject({
      actorId: moderator.userId,
      reason: 'spamming chat',
      targetType: 'player',
      outcome: 'success',
      before: { status: 'user' },
      after: { status: 'banned', hours: 24 }
    })
    const profile = await api().get(`/api/v1/admin/players/${target.userId}`).set(bearer(moderator)).expect(200)
    expect(profile.body.activeBan).toMatchObject({ reason: 'spamming chat', bannedBy: moderator.userId })
    expect(profile.body.activeBan.expiresAt).toBeGreaterThan(Date.now())

    await api()
      .post(`/api/v1/admin/players/${target.userId}/unban`)
      .set(bearer(moderator))
      .send({ reason: 'appealed' })
      .expect(204)
    const login = await api().post('/api/v1/auth/login').send({ email: target.email, password: PASSWORD }).expect(200)
    await api()
      .get('/api/v1/users/me')
      .set({ Authorization: `Bearer ${login.body.accessToken}` })
      .expect(200)
  })

  it('needs a reason, a sane duration, and an account of a lower rank', async () => {
    const target = await player()
    const ban = (who: SignedUp, id: string, body: object) =>
      api().post(`/api/v1/admin/players/${id}/ban`).set(bearer(who)).send(body)

    await ban(moderator, target.userId, {}).expect(400)
    await ban(moderator, target.userId, { reason: 'ok' }).expect(400)
    await ban(moderator, target.userId, { reason: 'fine reason', durationHours: 0 }).expect(400)
    await ban(moderator, target.userId, { reason: 'fine reason', durationHours: 999999 }).expect(400)
    await ban(moderator, admin.userId, { reason: 'fine reason' }).expect(403)
    await ban(moderator, moderator.userId, { reason: 'fine reason' }).expect(403)
    await ban(analyst, target.userId, { reason: 'fine reason' }).expect(403)
    // An admin outranks a moderator
    const other = await signUpAdmin(testApp, database, 'moderator')
    await ban(admin, other.userId, { reason: 'fine reason', durationHours: 1 }).expect(204)
    await api()
      .post(`/api/v1/admin/players/${other.userId}/unban`)
      .set(bearer(admin))
      .send({ reason: 'mistake' })
      .expect(204)
  })

  it('lifts a ban whose time has passed', async () => {
    const target = await player()
    await api()
      .post(`/api/v1/admin/players/${target.userId}/ban`)
      .set(bearer(moderator))
      .send({ reason: 'short ban', durationHours: 1 })
      .expect(204)
    await database.client.playerBan.updateMany({
      where: { userId: target.userId },
      data: { expiresAt: new Date(Date.now() - 1000) }
    })

    expect(await testApp.app.get<PlayersService>(PLAYERS_SERVICE).liftExpiredBans()).toBeGreaterThanOrEqual(1)

    expect((await database.client.user.findUniqueOrThrow({ where: { id: target.userId } })).status).toBe('user')
  })
})

describe('the other actions', () => {
  it('ends the sessions of a player', async () => {
    const target = await player()

    await api()
      .post(`/api/v1/admin/players/${target.userId}/logout`)
      .set(bearer(moderator))
      .send({ reason: 'shared account' })
      .expect(204)

    await api().get('/api/v1/users/me').set(bearer(target)).expect(401)
  })

  it('sends a verification email and a reset link', async () => {
    const target = await player()
    await database.client.localCredential.update({ where: { userId: target.userId }, data: { emailVerified: false } })
    const before = testApp.emails.messages.length

    await api()
      .post(`/api/v1/admin/players/${target.userId}/resend-verification`)
      .set(bearer(moderator))
      .send({ reason: 'lost mail' })
      .expect(204)
    await api()
      .post(`/api/v1/admin/players/${target.userId}/reset-password`)
      .set(bearer(moderator))
      .send({ reason: 'asked by the player' })
      .expect(204)

    expect(testApp.emails.messages.slice(before).map((message) => message.to)).toEqual([target.email, target.email])
  })

  it('changes a role for owners only, and refuses giving the role "banned"', async () => {
    const target = await player()
    const role = (who: SignedUp, body: object) =>
      api().put(`/api/v1/admin/players/${target.userId}/role`).set(bearer(who)).send(body)

    await role(admin, { role: 'moderator', reason: 'trusted' }).expect(403)
    await role(owner, { role: 'banned', reason: 'by role' }).expect(400)
    await role(owner, { role: 'moderator', reason: 'trusted player' }).expect(204)

    expect((await database.client.user.findUniqueOrThrow({ where: { id: target.userId } })).status).toBe('moderator')
    expect(await auditOf('players.change-role', target.userId)).toMatchObject({
      before: { status: 'user' },
      after: { status: 'moderator' }
    })
  })

  it('deletes an account for owners only, after the email is typed', async () => {
    const target = await player()
    const remove = (who: SignedUp, body: object) =>
      api().delete(`/api/v1/admin/players/${target.userId}`).set(bearer(who)).send(body)

    await remove(admin, { reason: 'requested', confirmEmail: target.email }).expect(403)
    await remove(owner, { reason: 'requested', confirmEmail: 'wrong@example.com' }).expect(400)
    await remove(owner, { reason: 'requested by the player', confirmEmail: target.email }).expect(204)

    // The profile stays for the trail, marked as deleted, with the personal data gone
    const profile = await api().get(`/api/v1/admin/players/${target.userId}`).set(bearer(owner)).expect(200)
    expect(profile.body).toMatchObject({ isDeleted: true, name: 'Deleted player' })
    const search = await api().get(`/api/v1/admin/players?q=${target.userId}`).set(bearer(owner)).expect(200)
    expect(search.body.result).toEqual([])
    const row = await database.client.user.findUniqueOrThrow({ where: { id: target.userId } })
    expect(row.deletedAt).not.toBeNull()
    expect(row.email).not.toBe(target.email)
    expect((await auditOf('players.delete', target.userId)).before).toMatchObject({ email: target.email })
  })

  it('keeps notes validated and for players that exist', async () => {
    const target = await player()
    const note = (id: string, body: object) =>
      api().post(`/api/v1/admin/players/${id}/notes`).set(bearer(moderator)).send(body)

    await note(target.userId, { text: '' }).expect(400)
    await note(randomUUID(), { text: 'hello' }).expect(404)
    await api()
      .post(`/api/v1/admin/players/${target.userId}/notes`)
      .set(bearer(analyst))
      .send({ text: 'x' })
      .expect(403)
  })
})

describe('the profile of unusual accounts', () => {
  it('shows a permanent ban, a lifted ban, and an account without logins or credentials', async () => {
    const target = await player()
    const ban = (body: object) =>
      api().post(`/api/v1/admin/players/${target.userId}/ban`).set(bearer(moderator)).send(body)

    await ban({ reason: 'first offence', durationHours: 1 }).expect(204)
    await api()
      .post(`/api/v1/admin/players/${target.userId}/unban`)
      .set(bearer(moderator))
      .send({ reason: 'sorry' })
      .expect(204)
    await ban({ reason: 'no more chances' }).expect(204)

    const profile = await api().get(`/api/v1/admin/players/${target.userId}`).set(bearer(moderator)).expect(200)
    expect(profile.body.activeBan).toMatchObject({ reason: 'no more chances', expiresAt: null, liftedAt: null })
    expect(profile.body.bans).toHaveLength(2)
    expect(profile.body.bans[1]).toMatchObject({ reason: 'first offence', liftedBy: moderator.userId })
    expect(profile.body.bans[1].liftedAt).toEqual(expect.any(Number))

    const directory = new PrismaPlayerDirectory(database.client)
    const loner = await database.client.user.create({
      data: { id: randomUUID(), name: 'Loner', email: 'loner@example.com', status: 'user', createdAt: new Date() }
    })
    const activity = await directory.activityOf(loner.id)
    expect(activity?.user).toMatchObject({ isEmailVerified: false, lastLoginAt: null })
    expect(activity?.sessions).toEqual([])
    expect(await directory.activityOf(randomUUID())).toBeNull()
    const found = await directory.search(
      { query: 'loner', isEmailVerified: false, sort: 'name', isDescending: false },
      { offset: 0, limit: 5 }
    )
    expect(found.players.map((row) => row.id)).toEqual([loner.id])
    expect(found.players[0].lastLoginAt).toBeNull()
  })

  it('filters by a verified email and by the end of a registration range', async () => {
    const verified = await api()
      .get('/api/v1/admin/players?isEmailVerified=true&registeredTo=2999-01-01T00:00:00Z')
      .set(bearer(moderator))
      .expect(200)
    expect(verified.body.result.length).toBeGreaterThan(0)
    expect(verified.body.result.every((p: { isEmailVerified: boolean }) => p.isEmailVerified)).toBe(true)
    await api().get('/api/v1/admin/players?isEmailVerified=maybe').set(bearer(moderator)).expect(400)
    await api().get('/api/v1/admin/players?registeredFrom=yesterday').set(bearer(moderator)).expect(400)
  })
})

describe('the timer that lifts expired bans', () => {
  it('lifts them by itself where the data lifecycle runs', async () => {
    const app = await startTestApp(database, { LIFECYCLE_ENABLED: 'true', ADMIN_BAN_CHECK_MS: '30' })
    try {
      const target = await player()
      await database.client.user.update({ where: { id: target.userId }, data: { status: 'banned' } })
      await database.client.playerBan.create({
        data: {
          id: randomUUID(),
          userId: target.userId,
          bannedBy: moderator.userId,
          reason: 'old',
          previousStatus: 'user',
          createdAt: new Date(Date.now() - 7200_000),
          expiresAt: new Date(Date.now() - 3600_000)
        }
      })

      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const { status } = await database.client.user.findUniqueOrThrow({ where: { id: target.userId } })
        if (status === 'user') break
        await new Promise((resolve) => setTimeout(resolve, 30))
      }

      expect((await database.client.user.findUniqueOrThrow({ where: { id: target.userId } })).status).toBe('user')
    } finally {
      await app.close()
    }
  })
})
