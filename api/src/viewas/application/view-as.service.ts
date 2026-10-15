import { AuditService } from '../../admin/application/audit.service'
import { AccessTokenService, SessionRepository } from '../../auth/application/ports'
import { Principal } from '../../auth/application/auth.service'
import { assertOutranks } from '../../players/domain/player-moderation'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { NotFoundError } from '../../shared/domain/errors'
import { UserRepository } from '../../users/application/user.repository'
import { User } from '../../users/domain/user.entity'

export interface ViewAsStarted {
  accessToken: string
  expiresAt: Date
  player: { id: string; name: string }
}

// "View as player" (design §25.2). Starting one gives the admin a second session that shows another player's game in
// read-only mode: the guards enforce it on every route and socket event (VIEW_AS_READ_ONLY). The admin's own session is not
// touched, so the console stays open next to the view. It ends at its time limit, at an exit, or when the admin is demoted.
export class ViewAsService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: Pick<UserRepository, 'findById'>,
    private readonly accessTokens: AccessTokenService,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly ttlMs: number
  ) {}

  // The admin may view only someone of a lower rank, and not themselves
  async start(admin: User, playerId: string, reason: string): Promise<ViewAsStarted> {
    const player = await this.users.findById(playerId)

    if (!player) {
      throw new NotFoundError('Player not found')
    }
    assertOutranks(admin, player)

    const now = this.clock.now()
    const expiresAt = new Date(now.getTime() + this.ttlMs)
    const sessionId = this.ids.next()

    await this.sessions.add({
      id: sessionId,
      userId: admin.id,
      // No refresh token exists: this value matches no hash, so the session can never be renewed
      refreshTokenHash: `view-as:${sessionId}`,
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      revokedAt: null,
      userAgent: null,
      viewAs: { userId: player.id, reason }
    })

    return {
      accessToken: this.accessTokens.sign({
        userId: admin.id,
        sessionId,
        ttlSeconds: Math.ceil(this.ttlMs / 1000)
      }),
      expiresAt,
      player: { id: player.id, name: player.name }
    }
  }

  // Ends the view the principal is in and writes it to the trail
  async end({ identity, user, viewAs }: Principal & Required<Pick<Principal, 'viewAs'>>, ip: string | null) {
    const session = identity.sessionId ? await this.sessions.findById(identity.sessionId) : null

    if (session && session.revokedAt === null) {
      await this.sessions.update({ ...session, revokedAt: this.clock.now() })
    }
    await this.audit.record({
      actorId: viewAs.adminId,
      actorRole: viewAs.adminStatus,
      action: 'players.view-as.end',
      outcome: 'success',
      targetType: 'player',
      targetId: user.id,
      reason: viewAs.reason,
      before: null,
      after: null,
      ip,
      requestId: null
    })
  }
}
