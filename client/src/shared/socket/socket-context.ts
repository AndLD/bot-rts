import { createContext, useContext } from 'react'
import { ClientToServerEvents, ServerToClientEvents } from '@lib/utils/socket-events'
import { Socket } from 'socket.io-client'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const SocketContext = createContext<GameSocket | null>(null)

// The socket, or null until it is created
export function useSocket(): GameSocket | null {
  return useContext(SocketContext)
}
