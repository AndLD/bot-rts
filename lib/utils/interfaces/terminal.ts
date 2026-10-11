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

// Where a terminal session is: the selected drive (by name) and the directory on it
export interface ITerminalCwd {
  drive: string | null
  directory: string | null
}

// The commands the server answers (design §11.1); the client adds `shell` and the shell mode itself
export const TERMINAL_COMMANDS = [
  { name: 'help', usage: 'help' },
  { name: 'ls', usage: 'ls [dir]' },
  { name: 'cd', usage: 'cd <path>' },
  { name: 'mkdir', usage: 'mkdir <name>' },
  { name: 'cat', usage: 'cat <file>' },
  { name: 'edit', usage: 'edit <file>' },
  { name: 'rm', usage: 'rm <file>' },
  { name: 'list', usage: 'list' },
  { name: 'modules', usage: 'modules' },
  { name: 'clear', usage: 'clear' },
  { name: 'exit', usage: 'exit' }
] as const

export type TerminalCommandName = (typeof TERMINAL_COMMANDS)[number]['name']

// What a command produced; the client decides how to show it
export type TerminalCommandResult =
  // Lines of data (a listing, a file), shown as they are
  | { type: 'output'; lines: string[] }
  | { type: 'help'; commands: { name: string; usage: string }[] }
  | { type: 'clear' }
  | { type: 'exit' }
  // The file to edit; the client saves it with 'save-terminal-file'
  | { type: 'edit'; path: string; content: string }
  | { type: 'error'; code: string; message: string }

export interface ITerminalCommandResponse {
  result: TerminalCommandResult
  cwd: ITerminalCwd
}
