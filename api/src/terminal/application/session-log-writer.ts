import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { TerminalRetention } from '../domain/terminal-retention'
import { TerminalSession } from '../domain/terminal-session'
import { TerminalSessionRepository } from './terminal-session.repository'

// Writes a line into the log of a bot whether or not a terminal is open on it (design §11.2.3): into the newest session of the
// bot, or into one of its own when the bot never had a terminal. Used for what scripts write and for security events.
export class SessionLogWriter {
  constructor(
    private readonly sessions: TerminalSessionRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly retention: TerminalRetention
  ) {}

  async write(botId: string, userId: string, kind: TERMINAL_LOG_KIND, text: string): Promise<void> {
    let session = await this.sessions.findLatestOfBot(botId)
    if (!session) {
      const now = this.clock.now()
      session = { id: this.ids.next(), botId, userId, startedAt: now, endedAt: now, fromBotId: null } as TerminalSession
      await this.sessions.add(session)
    }
    await this.sessions.appendLog({
      id: this.ids.next(),
      sessionId: session.id,
      botId,
      at: this.clock.now(),
      kind,
      text
    })
    await this.sessions.deleteOldestOrdinaryLogs(botId, this.retention.maxLinesPerBot)
  }
}

// What the access rules need to leave a trace (design §11.2.2)
export interface SecurityLog {
  record(botId: string, ownerId: string, text: string): Promise<void>
}

export class SessionSecurityLog implements SecurityLog {
  constructor(private readonly writer: SessionLogWriter) {}

  record(botId: string, ownerId: string, text: string): Promise<void> {
    return this.writer.write(botId, ownerId, TERMINAL_LOG_KIND.SECURITY, text)
  }
}
