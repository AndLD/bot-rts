import { IBot } from './interfaces/bots'
import { ModuleProps } from './interfaces/modules'

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
}

// The server sends nothing unprompted yet; game events arrive with the engine (Phase 5)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerToClientEvents {}
