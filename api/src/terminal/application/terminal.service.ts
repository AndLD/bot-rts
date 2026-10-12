import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'
import { BotsService } from '../../bots/application/bots.service'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { TerminalRetention } from '../domain/terminal-retention'
import { TerminalSession, TerminalLogEntry } from '../domain/terminal-session'
import { TerminalSessionClosedError } from '../domain/terminal.errors'
import { SessionLogWriter } from './session-log-writer'
import { LinkGate } from './link-gate'
import { TerminalSessionRepository } from './terminal-session.repository'

const DAY_MS = 24 * 3600 * 1000
const ORDINARY_KINDS = [TERMINAL_LOG_KIND.INPUT, TERMINAL_LOG_KIND.OUTPUT, TERMINAL_LOG_KIND.ERROR]

// Every connection to a bot's terminal is stored with all its lines (design §11.2, §11.2.3)
export class TerminalService {
  constructor(
    private readonly sessions: TerminalSessionRepository,
    private readonly bots: BotsService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly retention: TerminalRetention,
    private readonly links: LinkGate
  ) {
    this.writer = new SessionLogWriter(sessions, ids, clock, retention)
  }

  private readonly writer: SessionLogWriter

  // Starts a session on one of the player's bots; this is also when expired lines are dropped
  async open(userId: string, botId: string): Promise<TerminalSession> {
    await this.bots.getReachableBot(userId, botId)
    await this.links.ensureConnected(userId, botId)
    await this.dropExpiredLogs()

    const session: TerminalSession = {
      id: this.ids.next(),
      botId,
      userId,
      startedAt: this.clock.now(),
      endedAt: null,
      fromBotId: null
    }
    await this.sessions.add(session)
    return session
  }

  // A session on a bot of anyone, reached from one of the player's bots after the access checks (design §11.2.2)
  async openConnection(userId: string, fromBotId: string, targetBotId: string): Promise<TerminalSession> {
    await this.dropExpiredLogs()
    const session: TerminalSession = {
      id: this.ids.next(),
      botId: targetBotId,
      userId,
      startedAt: this.clock.now(),
      endedAt: null,
      fromBotId
    }
    await this.sessions.add(session)
    return session
  }

  async close(userId: string, sessionId: string): Promise<TerminalSession> {
    const session = await this.getOpenSession(userId, sessionId)
    const endedAt = this.clock.now()
    await this.sessions.close(session.id, endedAt)
    return { ...session, endedAt }
  }

  // Adds a line to an open session and keeps the bot within its line cap
  async record(userId: string, sessionId: string, kind: TERMINAL_LOG_KIND, text: string): Promise<TerminalLogEntry> {
    const session = await this.getOpenSession(userId, sessionId)
    const entry: TerminalLogEntry = {
      id: this.ids.next(),
      sessionId: session.id,
      botId: session.botId,
      at: this.clock.now(),
      kind,
      text
    }
    await this.sessions.appendLog(entry)
    await this.sessions.deleteOldestOrdinaryLogs(session.botId, this.retention.maxLinesPerBot)
    return entry
  }

  // Keeps what a script wrote in the log of its bot, whether or not a terminal is open on it (design §11.2.3): in the newest
  // session of the bot, or in one of its own when the bot never had a terminal
  async recordScriptOutput(userId: string, botId: string, kind: TERMINAL_LOG_KIND, text: string): Promise<void> {
    await this.writer.write(botId, userId, kind, text)
  }

  async history(userId: string, botId: string, limit: number): Promise<TerminalLogEntry[]> {
    await this.bots.getOwnedBot(userId, botId)
    return this.sessions.listLogsOfBot(botId, limit)
  }

  async getOpenSession(userId: string, sessionId: string): Promise<TerminalSession> {
    const session = await this.sessions.findById(sessionId)
    if (!session) {
      throw new NotFoundError('Terminal session not found')
    }
    if (session.userId !== userId) {
      throw new ForbiddenError('The terminal session belongs to another player')
    }
    if (session.endedAt) {
      throw new TerminalSessionClosedError()
    }
    return session
  }

  private async dropExpiredLogs() {
    const now = this.clock.now().getTime()
    await this.sessions.deleteLogsOlderThan(ORDINARY_KINDS, new Date(now - this.retention.logDays * DAY_MS))
    await this.sessions.deleteLogsOlderThan(
      [TERMINAL_LOG_KIND.SECURITY],
      new Date(now - this.retention.securityDays * DAY_MS)
    )
  }
}
