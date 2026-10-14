import type { UserStatus } from './interfaces/users'

// The Players page of the admin console (design §25.3)
export const PLAYER_SORTS = ['createdAt', 'name', 'email'] as const

export type PlayerSort = (typeof PLAYER_SORTS)[number]

export const BAN_DURATION_HOURS_MAX = 24 * 365

export interface IPlayerListItem {
  _id: string
  name: string
  email: string
  status: UserStatus
  isEmailVerified: boolean
  // Milliseconds since the epoch
  createdAt: number
  lastLoginAt: number | null
}

export interface IPlayersPage {
  result: IPlayerListItem[]
  meta: { pagination: { page: number; results: number; total: number } }
}

export interface IPlayerSession {
  _id: string
  userAgent: string | null
  createdAt: number
  lastUsedAt: number
  expiresAt: number
  isActive: boolean
}

export interface IPlayerBase {
  _id: string
  label: string | null
  botCount: number
}

export interface IPlayerBan {
  _id: string
  reason: string
  bannedBy: string
  createdAt: number
  expiresAt: number | null
  liftedAt: number | null
  liftedBy: string | null
}

export interface IPlayerNote {
  _id: string
  authorId: string
  text: string
  createdAt: number
}

export const TIMELINE_KINDS = ['registered', 'login', 'ban', 'unban', 'admin-action'] as const

export type TimelineKind = (typeof TIMELINE_KINDS)[number]

export interface ITimelineEntry {
  at: number
  kind: TimelineKind
  // The admin action or the reason, when there is one
  detail: string | null
}

export interface IPlayerResource {
  resource: string
  amount: number
}

export interface IPlayerProfile extends IPlayerListItem {
  isDeleted: boolean
  sessions: IPlayerSession[]
  bases: IPlayerBase[]
  botCount: number
  resources: IPlayerResource[]
  runningExecutions: number
  activeBan: IPlayerBan | null
  bans: IPlayerBan[]
  notes: IPlayerNote[]
  timeline: ITimelineEntry[]
}

// The Supervision page of the admin console (design §25.3)
export interface IQuarantinedPlayer {
  _id: string
  name: string
}

export interface ISupervisionState {
  isPaused: boolean
  areScriptsHalted: boolean
  quarantined: IQuarantinedPlayer[]
  // Scripts that are running now, and the ones among them held by a quarantine
  activeExecutions: number
  heldExecutions: number
}

// The words an admin types to confirm the two world-wide switches
export const PAUSE_CONFIRMATION = 'PAUSE'
export const HALT_CONFIRMATION = 'HALT'
