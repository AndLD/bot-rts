import { IPlayerBan, IPlayerListItem, IPlayerNote, IPlayerProfile } from '../../../../lib/utils/admin-players'
import { isSessionActive } from '../../auth/domain/session'
import { PlayerProfile } from '../application/players.service'
import { PlayerRow } from '../application/ports'
import { PlayerBan, PlayerNote } from '../domain/player-moderation'

export const toListItem = (row: PlayerRow): IPlayerListItem => ({
  _id: row.id,
  name: row.name,
  email: row.email,
  status: row.status,
  isEmailVerified: row.isEmailVerified,
  createdAt: row.createdAt.getTime(),
  lastLoginAt: row.lastLoginAt?.getTime() ?? null
})

export const toBanDto = (ban: PlayerBan): IPlayerBan => ({
  _id: ban.id,
  reason: ban.reason,
  bannedBy: ban.bannedBy,
  createdAt: ban.createdAt.getTime(),
  expiresAt: ban.expiresAt?.getTime() ?? null,
  liftedAt: ban.liftedAt?.getTime() ?? null,
  liftedBy: ban.liftedBy
})

export const toNoteDto = (note: PlayerNote): IPlayerNote => ({
  _id: note.id,
  authorId: note.authorId,
  text: note.text,
  createdAt: note.createdAt.getTime()
})

export function toProfileDto(profile: PlayerProfile, now: Date): IPlayerProfile {
  return {
    ...toListItem(profile.user),
    isDeleted: profile.user.deletedAt !== null,
    sessions: profile.sessions.map((session) => ({
      _id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt.getTime(),
      lastUsedAt: session.lastUsedAt.getTime(),
      expiresAt: session.expiresAt.getTime(),
      isActive: isSessionActive(session, now)
    })),
    bases: profile.bases.map(({ base, botCount }) => ({ _id: base.id, label: base.label, botCount })),
    botCount: profile.botCount,
    resources: profile.resources,
    runningExecutions: profile.runningExecutions,
    activeBan: profile.activeBan ? toBanDto(profile.activeBan) : null,
    bans: profile.bans.map(toBanDto),
    notes: profile.notes.map(toNoteDto),
    timeline: profile.timeline
  }
}
