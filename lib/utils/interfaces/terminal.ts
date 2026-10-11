import { ID } from '../types'

// What a line of a terminal session is (design §11.2.3): the player's input, the output shown, an error, or a security
// event (failed password attempt, lockout, adopt, reboot), which is kept longer
export enum TERMINAL_LOG_KIND {
  INPUT = 'input',
  OUTPUT = 'output',
  ERROR = 'error',
  SECURITY = 'security'
}

export interface ITerminalSession {
  _id: ID
  botId: ID
  startedAt: number
  endedAt?: number
}

export interface ITerminalLogEntry {
  _id: ID
  sessionId: ID
  botId: ID
  at: number
  kind: TERMINAL_LOG_KIND
  text: string
}
