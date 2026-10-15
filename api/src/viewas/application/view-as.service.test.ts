import { createAuthWorld } from '../../../tests/fakes/auth'
import { AuditService } from '../../admin/application/audit.service'
import { AuditLog } from '../../admin/application/ports'
import { NotFoundError, ForbiddenError } from '../../shared/domain/errors'
import { ViewAsService } from './view-as.service'

async function setup() {
  const world = createAuthWorld()
  const { repositories, clock, ids, accessTokens } = world
  const base = {
    createdAt: clock.now(),
    updatedAt: null,
    subscription: 'free' as never,
    privacyAcceptedVersion: null,
    privacyAcceptedAt: null,
    deletedAt: null
  }
  const admin = { ...base, id: 'a1', name: 'Ada', email: 'ada@example.com', status: 'admin' as const }
  const player = { ...base, id: 'p1', name: 'Pat', email: 'pat@example.com', status: 'user' as const }
  repositories.users.items.set(admin.id, admin)
  repositories.users.items.set(player.id, player)
  const entries: unknown[] = []
  const log = { append: async (entry: unknown) => void entries.push(entry) } as unknown as AuditLog
  const service = new ViewAsService(
    repositories.sessions,
    repositories.users,
    accessTokens,
    new AuditService(log, ids, clock),
    ids,
    clock,
    30 * 60_000
  )

  return { ...world, service, admin, player, entries }
}

describe('ViewAsService', () => {
  it('opens a session that cannot be refreshed and lasts for the time limit', async () => {
    const { service, admin, player, repositories, clock } = await setup()

    const started = await service.start(admin, player.id, 'support')

    expect(started.player).toEqual({ id: 'p1', name: 'Pat' })
    expect(started.expiresAt.getTime()).toBe(clock.now().getTime() + 30 * 60_000)
    const [session] = [...repositories.sessions.items.values()]
    expect(session).toMatchObject({ userId: 'a1', viewAs: { userId: 'p1', reason: 'support' } })
    expect(await repositories.sessions.findByRefreshTokenHash(session.refreshTokenHash)).toBe(session)
    expect(session.refreshTokenHash.startsWith('view-as:')).toBe(true)
  })

  it('refuses an unknown player, oneself and an equal rank', async () => {
    const { service, admin, repositories } = await setup()
    repositories.users.items.set('a2', { ...admin, id: 'a2' })

    await expect(service.start(admin, 'nobody', 'x')).rejects.toThrow(NotFoundError)
    await expect(service.start(admin, admin.id, 'x')).rejects.toThrow(ForbiddenError)
    await expect(service.start(admin, 'a2', 'x')).rejects.toThrow(ForbiddenError)
  })

  it('ends the view and writes it to the trail, with the admin as the actor', async () => {
    const { service, admin, player, repositories, entries, clock } = await setup()
    const started = await service.start(admin, player.id, 'support')
    const [session] = [...repositories.sessions.items.values()]
    const principal = {
      user: player,
      identity: {
        provider: 'local',
        subject: admin.id,
        email: admin.email,
        emailVerified: true,
        sessionId: session.id
      },
      viewAs: { adminId: admin.id, adminStatus: admin.status, reason: 'support', expiresAt: started.expiresAt }
    }

    await service.end(principal, '10.0.0.1')
    await service.end(principal, null)

    expect(repositories.sessions.items.get(session.id)?.revokedAt).toEqual(clock.now())
    expect(entries[0]).toMatchObject({ actorId: 'a1', action: 'players.view-as.end', targetId: 'p1', ip: '10.0.0.1' })
  })

  it('writes the trail even when the session is already gone', async () => {
    const { service, admin, player, entries } = await setup()

    await service.end(
      {
        user: player,
        identity: { provider: 'local', subject: 'a1', email: 'x', emailVerified: true },
        viewAs: { adminId: admin.id, adminStatus: admin.status, reason: 'r', expiresAt: new Date() }
      },
      null
    )

    expect(entries).toHaveLength(1)
  })
})
