import { IBlueprint, IFactoryJob, IFactoryStatus } from './interfaces/crafting'
import { IBot, IBotWithModules } from './interfaces/bots'
import { ModuleProps } from './interfaces/modules'
import { IFile } from './interfaces/files'
import { ITerminalCommandResponse, ITerminalLogEntry, ITerminalSession } from './interfaces/terminal'

// The error half of an acknowledgement
export interface SocketError {
  code: number
  msg: string
}

// An event acknowledgement: `(result)` on success, `(null, error)` on failure
export type SocketAck<T> = (result: T | null, error?: SocketError) => void

// The events a client sends to the server (Socket.IO typed events)
export interface ClientToServerEvents {
  'get-user-bases': (ack: SocketAck<IBot[]>) => void
  'get-user-bots': (ack: SocketAck<IBot[]>) => void
  'get-bot-modules': (botId: string, ack: SocketAck<ModuleProps[]>) => void
  // The factory of a base (design §9.3): what it is working on and the parts and blueprints it holds
  'get-factory': (baseId: string, ack: SocketAck<IFactoryStatus>) => void
  'craft-module': (baseId: string, module: string, count: number | undefined, ack: SocketAck<IFactoryJob[]>) => void
  'research-module': (baseId: string, module: string, ack: SocketAck<IFactoryJob>) => void
  'learn-blueprint': (baseId: string, itemId: string, ack: SocketAck<IBlueprint>) => void
  'assemble-bot': (baseId: string, label: string | null, partIds: string[], ack: SocketAck<IBotWithModules>) => void
  // Opens a stored terminal session on one of the player's bots; it ends with 'close-terminal' or the disconnect
  'open-terminal': (botId: string, ack: SocketAck<ITerminalSession>) => void
  'close-terminal': (sessionId: string, ack: SocketAck<ITerminalSession>) => void
  // Runs a line the player typed in the terminal of an open session
  'terminal-command': (sessionId: string, line: string, ack: SocketAck<ITerminalCommandResponse>) => void
  // Saves the file an 'edit' result asked for, in the directory the session is in
  'save-terminal-file': (sessionId: string, path: string, content: string, ack: SocketAck<IFile>) => void
  // The newest stored lines of a bot's terminal sessions, oldest first
  'get-terminal-history': (botId: string, limit: number, ack: SocketAck<ITerminalLogEntry[]>) => void
}

// The server sends nothing unprompted yet; game events arrive with the engine (Phase 5)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerToClientEvents {}
