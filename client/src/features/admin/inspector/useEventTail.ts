'use client'

import { useEffect, useRef, useState } from 'react'
import { ADMIN_SOCKET_NAMESPACE, AdminServerToClientEvents } from '@lib/utils/admin'
import type { ITailEvent } from '@lib/utils/admin-inspector'
import { io, Socket } from 'socket.io-client'
import { API_URL } from '../../../shared/config'
import { useToken } from '../../../shared/store/hooks'

const KEPT = 50

// The newest game events of the whole world, pushed over the admin namespace, newest first
export function useEventTail() {
  const token = useToken()
  const latestToken = useRef(token)
  latestToken.current = token
  const [events, setEvents] = useState<ITailEvent[]>([])

  useEffect(() => {
    if (!token) {
      return
    }
    const socket: Socket<AdminServerToClientEvents> = io(`${API_URL}${ADMIN_SOCKET_NAMESPACE}`, {
      withCredentials: true,
      transports: ['websocket'],
      reconnectionDelayMax: 5000,
      auth: (callback) => callback({ token: latestToken.current })
    })

    socket.on('game-event-tail', (tail) => setEvents((current) => [tail, ...current].slice(0, KEPT)))

    return () => {
      socket.disconnect()
    }
  }, [token])

  return events
}
