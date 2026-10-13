'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'
import { io } from 'socket.io-client'
import { API_TAGS, emptyApi } from '../api/empty-api'
import { useRefreshSession } from '../../features/auth/hooks'
import { API_URL } from '../config'
import { useAppDispatch, useToken } from '../store/hooks'
import { ConnectionStatus, ConnectionStatusContext, GameSocket, SocketContext } from './socket-context'

// How long "connection restored" stays on screen
const RESTORED_SHOWN_MS = 4000
// The pause before a lost connection is tried again grows from the first to the longest
const RECONNECT_DELAY_MS = 1000
const RECONNECT_DELAY_MAX_MS = 5000

// The connection to the game server, alive while the player is signed in. When the server rejects an expired access
// token in the handshake, the session is refreshed and the connection retried. When the connection is lost (the server went
// down, the network dropped) it is tried again with a growing pause until it holds, without a page refresh; the status is
// told to the screen, and what the screen shows from the server is read again once it is back.
export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useToken()
  const refreshSession = useRefreshSession()
  const dispatch = useAppDispatch()
  const [socket, setSocket] = useState<GameSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connected')

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
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      auth: (callback) => callback({ token: latestToken.current })
    })

    let isLost = false
    let restoredTimer: ReturnType<typeof setTimeout> | undefined
    const lose = () => {
      clearTimeout(restoredTimer)
      isLost = true
      setStatus('lost')
    }

    connection.on('connect_error', async (error) => {
      if (error.message !== SOCKET_TOKEN_EXPIRED) {
        lose()
        return
      }
      const refreshed = await latestRefresh.current()

      if (refreshed) {
        latestToken.current = refreshed
        connection.connect()
      }
    })
    connection.on('disconnect', (reason) => {
      // The player's own sign-out is not a loss
      if (reason !== 'io client disconnect') {
        lose()
      }
      // The server ended the connection: the client does not try again by itself then
      if (reason === 'io server disconnect') {
        connection.connect()
      }
    })
    connection.io.on('reconnect_attempt', () => isLost && setStatus('reconnecting'))
    connection.on('connect', () => {
      if (!isLost) {
        return
      }
      isLost = false
      setStatus('restored')
      dispatch(emptyApi.util.invalidateTags([...API_TAGS]))
      restoredTimer = setTimeout(() => setStatus('connected'), RESTORED_SHOWN_MS)
    })

    setSocket(connection)

    return () => {
      clearTimeout(restoredTimer)
      connection.disconnect()
      setSocket(null)
      setStatus('connected')
    }
  }, [isSignedIn, dispatch])

  return (
    <SocketContext.Provider value={socket}>
      <ConnectionStatusContext.Provider value={status}>{children}</ConnectionStatusContext.Provider>
    </SocketContext.Provider>
  )
}
