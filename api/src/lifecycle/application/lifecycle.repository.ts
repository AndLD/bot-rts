import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'

export const LIFECYCLE_REPOSITORY = Symbol('LifecycleRepository')

export interface InactiveAccount {
  userId: string
  name: string
  email: string
  // When the player was told the account will be erased; null when not yet
  noticeSentAt: Date | null
}

// The queries of the cleanup job. Every `delete*` returns how many rows it removed.
export interface LifecycleRepository {
  // Accounts created before `before` whose email was never confirmed and that own no base
  findStaleUnverifiedUserIds(before: Date, limit: number): Promise<string[]>
  deleteUsers(userIds: readonly string[]): Promise<number>
  // Free-plan players with the plain `user` role who were last active before `before` and run no script (offline scripts
  // keep running, so a player with an active execution is not inactive)
  findInactiveAccounts(lastActiveBefore: Date, limit: number): Promise<InactiveAccount[]>
  markInactivityNotice(userId: string, at: Date): Promise<void>
  // A player who was active again after the notice is not erased: forgets the notices of everyone who came back
  clearNoticesOfReturnedPlayers(): Promise<number>
  deleteTerminalLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date): Promise<number>
  deleteEndedTerminalSessionsWithoutLogs(before: Date): Promise<number>
  deleteEndedExecutionsBefore(before: Date): Promise<number>
  // Sessions and links that expired (or were revoked or used) before `before`
  deleteExpiredAuthData(before: Date): Promise<number>
}
