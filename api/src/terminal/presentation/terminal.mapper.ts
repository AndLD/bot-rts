import { ITerminalLogEntry, ITerminalSession } from '../../../../lib/utils/interfaces/terminal'
import { TerminalLogEntry, TerminalSession } from '../domain/terminal-session'

export function toSessionDto(session: TerminalSession): ITerminalSession {
  const dto: ITerminalSession = { _id: session.id, botId: session.botId, startedAt: session.startedAt.getTime() }
  if (session.endedAt) {
    dto.endedAt = session.endedAt.getTime()
  }
  return dto
}

export function toLogEntryDto(entry: TerminalLogEntry): ITerminalLogEntry {
  return {
    _id: entry.id,
    sessionId: entry.sessionId,
    botId: entry.botId,
    at: entry.at.getTime(),
    kind: entry.kind,
    text: entry.text
  }
}
