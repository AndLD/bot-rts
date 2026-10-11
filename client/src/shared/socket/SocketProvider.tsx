import { ReactNode, useEffect, useRef, useState } from 'react'
import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'
import { io } from 'socket.io-client'
import { useRefreshSession } from '../../features/auth/hooks'
import { API_URL } from '../config'
import { useToken } from '../store/hooks'
import { GameSocket, SocketContext } from './socket-context'

// The connection to the game server, alive while the player is signed in. When the server rejects an expired access
// token in the handshake, the session is refreshed and the connection retried.
export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useToken()
  const refreshSession = useRefreshSession()
  const [socket, setSocket] = useState<GameSocket | null>(null)

  // Reconnection attempts read the latest token and refresher without recreating the socket
  const latestToken = useRef(token)
  const latestRefresh = useRef(refreshSession)
  latestToken.current = token
  latestRefresh.current = refreshSession

  const isSignedIn = Boolean(token)

  useEffect(() => {
    if (!isSignedIn) {
      return
    }

    const connection: GameSocket = io(API_URL, {
      withCredentials: true,
      reconnectionDelay: 1000,
      auth: (callback) => callback({ token: latestToken.current })
    })

    connection.on('connect_error', async (error) => {
      if (error.message === SOCKET_TOKEN_EXPIRED) {
        const refreshed = await latestRefresh.current()

        if (refreshed) {
          latestToken.current = refreshed
          connection.connect()
        }
      }
    })

    setSocket(connection)

    return () => {
      connection.disconnect()
      setSocket(null)
    }
  }, [isSignedIn])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}
