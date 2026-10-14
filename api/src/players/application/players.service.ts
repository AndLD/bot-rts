import { IPlayerResource, ITimelineEntry } from '../../../../lib/utils/admin-players'
import { RESOURCES } from '../../../../lib/utils/interfaces/resources'
import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { AuditService } from '../../admin/application/audit.service'
import { eraseAccount } from '../../auth/application/account-erasure'
import { CredentialAuthService } from '../../auth/application/credential-auth.service'
import { StorageModule } from '../../modules/domain/game-module'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Logger } from '../../shared/application/logger'
import { NotFoundError, ValidationError } from '../../shared/domain/errors'
import { User } from '../../users/domain/user.entity'
import { assertAssignableRole, assertOutranks, isBanActive, PlayerBan, PlayerNote } from '../domain/player-moderation'
import { PlayerActivity, PlayerDirectory, PlayerFilter, PlayerModerationRepository } from './ports'

const HOUR_MS = 3_600_000
const TIMELINE_LENGTH = 50

export interface Actor {
  id: string
  status: UserStatus
}

// What an action changed, for the audit trail
export interface Change {
  before: unknown
  after: unknown
}

export interface PlayerProfile extends PlayerActivity {
  resources: IPlayerResource[]
  bans: PlayerBan[]
  activeBan: PlayerBan | null
  notes: PlayerNote[]
  timeline: ITimelineEntry[]
}

// The Players page (design §25.3): search, the profile and the moderation actions. Every action checks that the admin outranks
// the player; the controller adds the reason and the audit entry.
export class PlayersService {
  constructor(
    private readonly directory: PlayerDirectory,
    private readonly moderation: PlayerModerationRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditService,
    private readonly credentials: CredentialAuthService | undefined,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly logger: Logger
  ) {}

  search(filter: PlayerFilter, page: number, pageSize: number) {
    return this.directory.search(filter, { offset: (page - 1) * pageSize, limit: pageSize })
  }

  async profile(userId: string): Promise<PlayerProfile> {
    const activity = await this.directory.activityOf(userId)

    if (!activity) {
      throw new NotFoundError('Player not found')
    }
    const now = this.clock.now()
    const [bans, notes, actions] = await Promise.all([
      this.moderation.listBans(userId),
      this.moderation.listNotes(userId),
      this.audit.list({ targetId: userId }, { page: 1, pageSize: TIMELINE_LENGTH })
    ])

    return {
      ...activity,
      resources: this.totals(activity),
      bans,
      activeBan: bans.find((ban) => isBanActive(ban, now)) ?? null,
      notes,
      timeline: this.timeline(activity, bans, actions.entries)
    }
  }

  async ban(actor: Actor, userId: string, reason: string, durationHours: number | undefined): Promise<Change> {
    return this.unitOfWork.run(async ({ users, sessions, moderation }) => {
      const target = await this.requireTarget(users, actor, userId)

      if (target.status === 'banned') {
        throw new ValidationError('The player is already banned')
      }
      const now = this.clock.now()
      await moderation.addBan({
        id: this.ids.next(),
        userId,
        bannedBy: actor.id,
        reason,
        previousStatus: target.status,
        createdAt: now,
        expiresAt: durationHours === undefined ? null : new Date(now.getTime() + durationHours * HOUR_MS),
        liftedAt: null,
        liftedBy: null
      })
      await users.update({ ...target, status: 'banned', updatedAt: now })
      await sessions.revokeAllOfUser(userId, now)

      return { before: { status: target.status }, after: { status: 'banned', hours: durationHours ?? null } }
    })
  }

  async unban(actor: Actor, userId: string): Promise<Change> {
    return this.unitOfWork.run(async ({ users, moderation }) => {
      const target = await this.requireTarget(users, actor, userId)
      const ban = (await moderation.listBans(userId)).find((candidate) => candidate.liftedAt === null)

      if (target.status !== 'banned' || !ban) {
        throw new ValidationError('The player is not banned')
      }
      await this.lift(users, moderation, target, ban, actor.id)

      return { before: { status: 'banned' }, after: { status: ban.previousStatus } }
    })
  }

  // One pass of the timer: a failure is logged and never ends the schedule
  async sweepExpiredBans(): Promise<void> {
    try {
      await this.liftExpiredBans()
    } catch (error) {
      this.logger.error(error)
    }
  }

  // Ends the bans whose time has passed; run by a timer, not by an admin
  async liftExpiredBans(): Promise<number> {
    const expired = await this.moderation.listExpiredBans(this.clock.now())

    for (const ban of expired) {
      await this.unitOfWork.run(async ({ users, moderation }) => {
        const user = await users.findById(ban.userId)
        await this.lift(users, moderation, user, ban, null)
      })
    }

    return expired.length
  }

  async forceLogout(actor: Actor, userId: string): Promise<Change> {
    return this.unitOfWork.run(async ({ users, sessions }) => {
      await this.requireTarget(users, actor, userId)
      await sessions.revokeAllOfUser(userId, this.clock.now())

      return { before: null, after: { sessions: 'revoked' } }
    })
  }

  async resendVerification(actor: Actor, userId: string): Promise<Change> {
    const target = await this.target(actor, userId)
    await this.requireCredentials().resendVerification(target.email)

    return { before: null, after: { email: 'verification sent' } }
  }

  async triggerPasswordReset(actor: Actor, userId: string): Promise<Change> {
    const target = await this.target(actor, userId)
    await this.requireCredentials().requestPasswordReset(target.email)

    return { before: null, after: { password: 'reset link sent' } }
  }

  async changeRole(actor: Actor, userId: string, role: UserStatus): Promise<Change> {
    assertAssignableRole(role)

    return this.unitOfWork.run(async ({ users }) => {
      const target = await this.requireTarget(users, actor, userId)

      if (target.status === 'banned') {
        throw new ValidationError('Unban the player before changing the role')
      }
      await users.update({ ...target, status: role, updatedAt: this.clock.now() })

      return { before: { status: target.status }, after: { status: role } }
    })
  }

  // The typed confirmation is the player's current email
  async deleteAccount(actor: Actor, userId: string, confirmEmail: string): Promise<Change> {
    return this.unitOfWork.run(async (repositories) => {
      const target = await this.requireTarget(repositories.users, actor, userId)

      if (target.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
        throw new ValidationError('The typed email does not match the player')
      }
      await eraseAccount(repositories, target, this.clock.now())

      return { before: { name: target.name, email: target.email }, after: { deleted: true } }
    })
  }

  async addNote(actor: Actor, userId: string, text: string): Promise<PlayerNote> {
    await this.target(actor, userId, { isRankChecked: false })
    const note: PlayerNote = { id: this.ids.next(), userId, authorId: actor.id, text, createdAt: this.clock.now() }
    await this.moderation.addNote(note)

    return note
  }

  private async target(actor: Actor, userId: string, options = { isRankChecked: true }): Promise<User> {
    return this.unitOfWork.run(({ users }) =>
      options.isRankChecked ? this.requireTarget(users, actor, userId) : this.requireUser(users, userId)
    )
  }

  private async requireUser(users: { findById(id: string): Promise<User | null> }, userId: string): Promise<User> {
    const user = await users.findById(userId)

    if (!user || user.deletedAt) {
      throw new NotFoundError('Player not found')
    }

    return user
  }

  private async requireTarget(users: { findById(id: string): Promise<User | null> }, actor: Actor, userId: string) {
    const user = await this.requireUser(users, userId)
    assertOutranks(actor, user)

    return user
  }

  private requireCredentials(): CredentialAuthService {
    if (!this.credentials) {
      throw new ValidationError('This sign-in provider does not manage credentials here')
    }

    return this.credentials
  }

  private async lift(
    users: { update(user: User): Promise<void> },
    moderation: PlayerModerationRepository,
    user: User | null,
    ban: PlayerBan,
    liftedBy: string | null
  ) {
    const now = this.clock.now()
    await moderation.updateBan({ ...ban, liftedAt: now, liftedBy })
    if (user && user.status === 'banned') {
      await users.update({ ...user, status: ban.previousStatus, updatedAt: now })
    }
  }

  private totals({ storages }: PlayerActivity): IPlayerResource[] {
    const boxes = storages.map((module) => new StorageModule(module))

    return RESOURCES.map((resource) => ({
      resource,
      amount: boxes.reduce((sum, box) => sum + box.amountOf(resource), 0)
    })).filter(({ amount }) => amount > 0)
  }

  private timeline(
    { user, sessions }: PlayerActivity,
    bans: PlayerBan[],
    actions: Array<{ at: Date; action: string; reason: string | null }>
  ): ITimelineEntry[] {
    const entries: ITimelineEntry[] = [
      { at: user.createdAt.getTime(), kind: 'registered', detail: null },
      ...sessions.map((session) => ({
        at: session.createdAt.getTime(),
        kind: 'login' as const,
        detail: session.userAgent
      })),
      ...bans.map((ban) => ({ at: ban.createdAt.getTime(), kind: 'ban' as const, detail: ban.reason })),
      ...bans.flatMap((ban) =>
        ban.liftedAt ? [{ at: ban.liftedAt.getTime(), kind: 'unban' as const, detail: null }] : []
      ),
      ...actions.map((entry) => ({ at: entry.at.getTime(), kind: 'admin-action' as const, detail: entry.action }))
    ]

    return entries.sort((a, b) => b.at - a.at).slice(0, TIMELINE_LENGTH)
  }
}
