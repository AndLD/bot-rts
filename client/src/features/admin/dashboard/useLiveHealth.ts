'use client'

import { useEffect, useRef, useState } from 'react'
import { ADMIN_SOCKET_NAMESPACE, AdminServerToClientEvents } from '@lib/utils/admin'
import { io, Socket } from 'socket.io-client'
import { api, useMonitoringHealthQuery } from '../../../shared/api'
import { API_URL } from '../../../shared/config'
import { useAppDispatch, useToken } from '../../../shared/store/hooks'

// The health report is also asked for now and then, so the dashboard keeps working while the live connection is down
const POLL_MS = 30_000

// The health report, kept fresh by the admin Socket.IO namespace; a pushed report replaces the cached one
export function useLiveHealth() {
  const dispatch = useAppDispatch()
  const token = useToken()
  const latestToken = useRef(token)
  latestToken.current = token
  const [isLive, setLive] = useState(false)
  const query = useMonitoringHealthQuery(undefined, { pollingInterval: POLL_MS })

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

    socket.on('connect', () => setLive(true))
    socket.on('disconnect', () => setLive(false))
    socket.on('monitoring-health', (report) => {
      dispatch(api.util.updateQueryData('monitoringHealth', undefined, () => report))
    })

    return () => {
      socket.disconnect()
      setLive(false)
    }
  }, [token, dispatch])

  return { ...query, isLive }
}
