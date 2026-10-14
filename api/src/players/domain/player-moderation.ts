import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { ForbiddenError, ValidationError } from '../../shared/domain/errors'

export interface PlayerBan {
  readonly id: string
  readonly userId: string
  readonly bannedBy: string
  readonly reason: string
  // What an unban gives back
  readonly previousStatus: UserStatus
  readonly createdAt: Date
  readonly expiresAt: Date | null
  readonly liftedAt: Date | null
  readonly liftedBy: string | null
}

export interface PlayerNote {
  readonly id: string
  readonly userId: string
  readonly authorId: string
  readonly text: string
  readonly createdAt: Date
}

// An admin may act only on someone of a lower rank: a moderator on players, an admin on moderators, an owner on everyone else
const RANK: Partial<Record<UserStatus, number>> = { owner: 4, admin: 3, moderator: 2, analyst: 1 }

export const rankOf = (status: UserStatus): number => RANK[status] ?? 0

export function assertOutranks(
  actor: { id: string; status: UserStatus },
  target: { id: string; status: UserStatus }
): void {
  if (actor.id === target.id || rankOf(actor.status) <= rankOf(target.status)) {
    throw new ForbiddenError('You cannot act on this account')
  }
}

// Roles an owner can give; `banned` is a ban, never a role
export function assertAssignableRole(role: UserStatus): void {
  if (role === 'banned') {
    throw new ValidationError('Ban the player instead of giving the role "banned"')
  }
}

export const isBanActive = (ban: PlayerBan, now: Date): boolean =>
  ban.liftedAt === null && (ban.expiresAt === null || ban.expiresAt > now)
