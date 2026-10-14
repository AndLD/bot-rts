import { UserStatus } from '../../../../lib/utils/interfaces/users'
import { Bot } from '../../bots/domain/bot.entity'
import { Module } from '../../modules/domain/module.entity'
import { Session } from '../../auth/domain/session'
import { UserListItem } from '../../users/domain/user.entity'
import { PlayerBan, PlayerNote } from '../domain/player-moderation'

export const PLAYER_DIRECTORY = Symbol('PlayerDirectory')
export const PLAYER_MODERATION_REPOSITORY = Symbol('PlayerModerationRepository')

export interface PlayerFilter {
  // Matches the name or the email (a part of it), or the id exactly
  query?: string
  status?: UserStatus
  isEmailVerified?: boolean
  registeredFrom?: Date
  registeredTo?: Date
  sort: 'createdAt' | 'name' | 'email'
  isDescending: boolean
}

export interface PlayerRow extends UserListItem {
  lastLoginAt: Date | null
}

export interface PlayerActivity {
  user: PlayerRow
  sessions: Session[]
  bases: Array<{ base: Bot; botCount: number }>
  botCount: number
  // The storage modules of everything the player owns, for the resource totals
  storages: Module[]
  runningExecutions: number
}

// The read model of the Players page: search and everything the profile shows (one query shape per need, not a repository)
export interface PlayerDirectory {
  search(
    filter: PlayerFilter,
    page: { offset: number; limit: number }
  ): Promise<{ players: PlayerRow[]; total: number }>
  activityOf(userId: string): Promise<PlayerActivity | null>
}

export interface PlayerModerationRepository {
  addBan(ban: PlayerBan): Promise<void>
  updateBan(ban: PlayerBan): Promise<void>
  listBans(userId: string): Promise<PlayerBan[]>
  // Bans nobody lifted whose time has come
  listExpiredBans(now: Date): Promise<PlayerBan[]>
  addNote(note: PlayerNote): Promise<void>
  listNotes(userId: string): Promise<PlayerNote[]>
}
