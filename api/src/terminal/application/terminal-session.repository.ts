import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { TerminalLogEntry, TerminalSession } from '../domain/terminal-session'

export const TERMINAL_SESSION_REPOSITORY = Symbol('TerminalSessionRepository')

export interface TerminalSessionRepository {
  add(session: TerminalSession): Promise<void>
  findById(id: string): Promise<TerminalSession | null>
  close(id: string, endedAt: Date): Promise<void>
  appendLog(entry: TerminalLogEntry): Promise<void>
  // The newest `limit` lines of a bot over all its sessions, oldest first
  listLogsOfBot(botId: string, limit: number): Promise<TerminalLogEntry[]>
  // Retention (design §11.2.3): drops lines of the given kinds older than `before`, and the oldest ordinary lines of a
  // bot beyond `keep`
  deleteLogsOlderThan(kinds: readonly TERMINAL_LOG_KIND[], before: Date): Promise<void>
  deleteOldestOrdinaryLogs(botId: string, keep: number): Promise<void>
}
