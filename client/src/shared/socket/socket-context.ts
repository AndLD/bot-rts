import { createContext, useContext } from 'react'
import { ClientToServerEvents, ServerToClientEvents } from '@lib/utils/socket-events'
import { Socket } from 'socket.io-client'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const SocketContext = createContext<GameSocket | null>(null)

// The socket, or null until it is created
export function useSocket(): GameSocket | null {
  return useContext(SocketContext)
}

// How the connection to the game server is doing: `restored` is told for a few seconds after a loss, then it is `connected`
export type ConnectionStatus = 'connected' | 'lost' | 'reconnecting' | 'restored'

export const ConnectionStatusContext = createContext<ConnectionStatus>('connected')

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionStatusContext)
}
