import { TERMINAL_LOG_KIND } from '../../../../lib/utils/interfaces/terminal'

export interface TerminalSession {
  readonly id: string
  readonly botId: string
  readonly userId: string
  readonly startedAt: Date
  readonly endedAt: Date | null
  // The bot the player connected from, when the session is on another bot (design §11.2.2)
  readonly fromBotId: string | null
}

export interface TerminalLogEntry {
  readonly id: string
  readonly sessionId: string
  readonly botId: string
  readonly at: Date
  readonly kind: TERMINAL_LOG_KIND
  readonly text: string
}
