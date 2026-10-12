import { IBlueprint, IFactoryJob, IFactoryStatus } from './interfaces/crafting'
import { IBot, IBotWithModules } from './interfaces/bots'
import { ModuleProps } from './interfaces/modules'
import { IExecution, IScriptLog } from './interfaces/executions'
import { IFile } from './interfaces/files'
import { ILiveArea, IMapRange, IMapUpdate, IMapView, IRadioChange } from './interfaces/map'
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
  // The player's map inside a range, fog of war applied (design §4.2)
  'get-map': (range: IMapRange, ack: SocketAck<IMapView>) => void
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

// What the server pushes to every connection of a player (design §11.2.3, §12.3)
export interface ServerToClientEvents {
  // A line one of the player's scripts wrote
  'script-log': (log: IScriptLog) => void
  // An execution started, changed state or ended
  execution: (execution: IExecution) => void
  // Only the bots whose link to the base changed, or whose signal strength did
  'radio-changes': (changes: IRadioChange[]) => void
  // Something that happened in the game and the player may see (design §24.1); the typed events come with the animations
  'game-event': (event: { type: string; at: number }) => void
  // Cells of the player's map that changed
  'map-cells': (update: IMapUpdate) => void
  // The squares the player's scanners keep live now (all of them, every time they change)
  'live-areas': (areas: ILiveArea[]) => void
}
