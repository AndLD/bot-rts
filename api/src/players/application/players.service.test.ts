import {
  FakeClock,
  FakeUnitOfWork,
  InMemoryAuthTokenRepository,
  InMemoryBotRepository,
  InMemoryCredentialRepository,
  InMemoryIdentityRepository,
  InMemoryPlayerModerationRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  SequentialIdGenerator
} from '../../../tests/fakes/fakes'
import { buildModule, buildUser } from '../../../tests/integration/builders'
import { AuditService } from '../../admin/application/audit.service'
import { CredentialAuthService } from '../../auth/application/credential-auth.service'
import { Repositories } from '../../persistence/application/unit-of-work'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { PlayersService } from './players.service'
import { PlayerActivity, PlayerDirectory } from './ports'

const HOUR = 3_600_000

function setup(options: { withCredentials?: boolean } = {}) {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const moderation = new InMemoryPlayerModerationRepository()
  const repositories = {
    users,
    sessions,
    moderation,
    identities: new InMemoryIdentityRepository(),
    credentials: new InMemoryCredentialRepository(),
    authTokens: new InMemoryAuthTokenRepository(),
    bots: new InMemoryBotRepository()
  } as unknown as Repositories
  const clock = new FakeClock()
  const auditEntries: Array<{ at: Date; action: string; reason: string | null }> = []
  const audit = { list: async () => ({ entries: auditEntries, total: auditEntries.length }) } as unknown as AuditService
  const credentials = {
    resendVerification: jest.fn(async () => undefined),
    requestPasswordReset: jest.fn(async () => undefined)
  }
  let activity: PlayerActivity | null = null
  const directory: PlayerDirectory = {
    search: jest.fn(async () => ({ players: [], total: 0 })),
    activityOf: async () => activity
  }
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
  const service = new PlayersService(
    directory,
    moderation,
    new FakeUnitOfWork(repositories),
    audit,
    options.withCredentials === false ? undefined : (credentials as unknown as CredentialAuthService),
    new SequentialIdGenerator(),
    clock,
    logger
  )

  return {
    users,
    sessions,
    moderation,
    clock,
    logger,
    credentials,
    service,
    directory,
    auditEntries,
    setActivity: (value: PlayerActivity | null) => (activity = value)
  }
}

const moderator = { id: 'mod', status: 'moderator' as const }
const admin = { id: 'adm', status: 'admin' as const }
const owner = { id: 'own', status: 'owner' as const }

describe('PlayersService moderation', () => {
  it('bans a player for a while: status, record and sessions, and unbans back to the previous status', async () => {
    const { users, sessions, moderation, service, clock } = setup()
    const player = buildUser({ status: 'unlimited' })
    await users.add(player)
    await sessions.add({
      id: 's1',
      userId: player.id,
      refreshTokenHash: 'h',
      createdAt: clock.now(),
      lastUsedAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + HOUR),
      revokedAt: null,
      userAgent: null
    })

    const change = await service.ban(moderator, player.id, 'spam', 2)

    expect(change).toEqual({ before: { status: 'unlimited' }, after: { status: 'banned', hours: 2 } })
    expect((await users.findById(player.id))?.status).toBe('banned')
    expect(moderation.bans[0]).toMatchObject({
      reason: 'spam',
      previousStatus: 'unlimited',
      bannedBy: 'mod',
      expiresAt: new Date(clock.now().getTime() + 2 * HOUR)
    })
    expect((await sessions.findById('s1'))?.revokedAt).toEqual(clock.now())
    await expect(service.ban(moderator, player.id, 'again', 1)).rejects.toThrow('already banned')

    expect(await service.unban(moderator, player.id)).toEqual({
      before: { status: 'banned' },
      after: { status: 'unlimited' }
    })
    expect((await users.findById(player.id))?.status).toBe('unlimited')
    expect(moderation.bans[0].liftedBy).toBe('mod')
    await expect(service.unban(moderator, player.id)).rejects.toThrow('not banned')
  })

  it('bans without an end when no duration is given', async () => {
    const { users, moderation, service } = setup()
    const player = buildUser()
    await users.add(player)

    await service.ban(moderator, player.id, 'cheating', undefined)

    expect(moderation.bans[0].expiresAt).toBeNull()
  })

  it('lifts the bans whose time has passed, and leaves a changed account alone', async () => {
    const { users, moderation, service, clock } = setup()
    const first = buildUser()
    const second = buildUser()
    await users.add(first)
    await users.add(second)
    await service.ban(moderator, first.id, 'x', 1)
    await service.ban(moderator, second.id, 'y', 1)
    // someone changed the second account by hand meanwhile
    await users.update({ ...(await users.findById(second.id))!, status: 'user' })
    clock.current = new Date(clock.current.getTime() + 2 * HOUR)

    expect(await service.liftExpiredBans()).toBe(2)
    expect((await users.findById(first.id))?.status).toBe('user')
    expect(moderation.bans.every((ban) => ban.liftedAt !== null && ban.liftedBy === null)).toBe(true)
    expect(await service.liftExpiredBans()).toBe(0)
  })

  it('logs a failed sweep and does not throw', async () => {
    const { moderation, service, logger } = setup()
    moderation.listExpiredBans = async () => {
      throw new Error('database down')
    }

    await expect(service.sweepExpiredBans()).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalled()
  })

  it('does not let an admin act on themselves, an equal or a higher rank, or on nobody', async () => {
    const { users, service } = setup()
    const other = buildUser({ status: 'moderator' })
    const boss = buildUser({ status: 'admin' })
    await users.add(other)
    await users.add(boss)

    await expect(service.ban(moderator, other.id, 'x', 1)).rejects.toThrow(ForbiddenError)
    await expect(service.ban(moderator, boss.id, 'x', 1)).rejects.toThrow(ForbiddenError)
    await expect(service.ban({ id: other.id, status: 'owner' }, other.id, 'x', 1)).rejects.toThrow(ForbiddenError)
    await expect(service.ban(admin, 'missing', 'x', 1)).rejects.toThrow(NotFoundError)
    await expect(service.ban(admin, other.id, 'x', 1)).resolves.toBeDefined()
  })

  it('ends the sessions of a player', async () => {
    const { users, sessions, service, clock } = setup()
    const player = buildUser()
    await users.add(player)
    await sessions.add({
      id: 's1',
      userId: player.id,
      refreshTokenHash: 'h',
      createdAt: clock.now(),
      lastUsedAt: clock.now(),
      expiresAt: new Date(clock.now().getTime() + HOUR),
      revokedAt: null,
      userAgent: null
    })

    await service.forceLogout(moderator, player.id)

    expect((await sessions.findById('s1'))?.revokedAt).not.toBeNull()
  })

  it('sends the verification and the reset link through the credential service', async () => {
    const { users, credentials, service } = setup()
    const player = buildUser({ email: 'p@x.io' })
    await users.add(player)

    await service.resendVerification(moderator, player.id)
    await service.triggerPasswordReset(moderator, player.id)

    expect(credentials.resendVerification).toHaveBeenCalledWith('p@x.io')
    expect(credentials.requestPasswordReset).toHaveBeenCalledWith('p@x.io')
  })

  it('says so when the provider does not manage credentials', async () => {
    const { users, service } = setup({ withCredentials: false })
    const player = buildUser()
    await users.add(player)

    await expect(service.resendVerification(moderator, player.id)).rejects.toThrow(ValidationError)
  })

  it('changes a role, but never to banned and never of a banned player', async () => {
    const { users, service } = setup()
    const player = buildUser()
    await users.add(player)

    expect(await service.changeRole(owner, player.id, 'moderator')).toEqual({
      before: { status: 'user' },
      after: { status: 'moderator' }
    })
    await expect(service.changeRole(owner, player.id, 'banned')).rejects.toThrow(ValidationError)
    await service.changeRole(owner, player.id, 'user')
    await service.ban(owner, player.id, 'x', 1)
    await expect(service.changeRole(owner, player.id, 'analyst')).rejects.toThrow('Unban')
  })

  it('erases an account after the typed email matches', async () => {
    const { users, service } = setup()
    const player = buildUser({ email: 'Player@X.io', name: 'Bob' })
    await users.add(player)

    await expect(service.deleteAccount(owner, player.id, 'other@x.io')).rejects.toThrow('does not match')
    const change = await service.deleteAccount(owner, player.id, ' player@x.io ')

    expect(change).toEqual({ before: { name: 'Bob', email: 'Player@X.io' }, after: { deleted: true } })
    expect((await users.findById(player.id))?.deletedAt).not.toBeNull()
    await expect(service.deleteAccount(owner, player.id, 'player@x.io')).rejects.toThrow(NotFoundError)
  })

  it('keeps notes of a player, also of a higher rank', async () => {
    const { users, moderation, service } = setup()
    const boss = buildUser({ status: 'admin' })
    await users.add(boss)

    const note = await service.addNote(moderator, boss.id, 'watch this one')

    expect(note).toMatchObject({ userId: boss.id, authorId: 'mod', text: 'watch this one' })
    expect(moderation.notes).toHaveLength(1)
    await expect(service.addNote(moderator, 'missing', 'x')).rejects.toThrow(NotFoundError)
  })
})

describe('PlayersService profile and search', () => {
  it('passes the search to the directory with an offset', async () => {
    const { service, directory } = setup()
    const filter = { sort: 'name' as const, isDescending: false, query: 'bo' }

    await service.search(filter, 3, 20)

    expect(directory.search).toHaveBeenCalledWith(filter, { offset: 40, limit: 20 })
  })

  it('totals the resources of the storages and tells the story of the account', async () => {
    const { service, setActivity, moderation, auditEntries, users, clock } = setup()
    const player = buildUser({ createdAt: new Date('2026-05-01T00:00:00.000Z') })
    await users.add(player)
    const storage = (iron: number, gold: number) =>
      buildModule('bot', {
        type: 'storage',
        props: {
          capacity: 100,
          items: [
            { resource: 'iron', amount: iron },
            { resource: 'gold', amount: gold }
          ]
        }
      })
    setActivity({
      user: { ...player, isEmailVerified: true, lastLoginAt: null },
      sessions: [
        {
          id: 's',
          userId: player.id,
          refreshTokenHash: 'h',
          createdAt: new Date('2026-05-02T00:00:00.000Z'),
          lastUsedAt: clock.now(),
          expiresAt: clock.now(),
          revokedAt: null,
          userAgent: 'Firefox'
        }
      ],
      bases: [],
      botCount: 0,
      storages: [storage(5, 0), storage(7, 2)],
      runningExecutions: 1
    })
    await service.ban(moderator, player.id, 'spam', 1)
    await service.unban(moderator, player.id)
    auditEntries.push({ at: new Date('2026-05-03T00:00:00.000Z'), action: 'players.add-note', reason: null })
    await service.ban(moderator, player.id, 'again', undefined)

    const profile = await service.profile(player.id)

    expect(profile.resources).toEqual([
      { resource: 'iron', amount: 12 },
      { resource: 'gold', amount: 2 }
    ])
    expect(profile.activeBan).toMatchObject({ reason: 'again' })
    expect(profile.bans).toHaveLength(2)
    expect(profile.notes).toEqual([])
    expect(profile.timeline.map((entry) => entry.kind).sort()).toEqual([
      'admin-action',
      'ban',
      'ban',
      'login',
      'registered',
      'unban'
    ])
    expect(moderation.bans).toHaveLength(2)
  })

  it('does not know a player that is not there', async () => {
    const { service } = setup()

    await expect(service.profile('missing')).rejects.toThrow(NotFoundError)
  })
})
