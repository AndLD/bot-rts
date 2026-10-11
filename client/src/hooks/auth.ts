import { useEffect, useRef, useState } from 'react'
import { appSlice } from '../store/app.reducer'
import { useVerifyTokenQuery } from '../store/auth.api.ts'
import { isJwtExpired } from '../utils/jwt'
import { useAppDispatch, useAppSelector } from './store'
import { useRefreshToken } from './store/auth.api'
import { API_URL } from '../utils/constants.ts'
import { io } from 'socket.io-client'
import axios from 'axios'
import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'

export function useAuth() {
  const dispatch = useAppDispatch()
  const token = useToken()
  const [isVerifyTokenSkip, setIsVerifyTokenSkip] = useState<boolean>(true)

  const verifyTokenQuery = useVerifyTokenQuery(undefined, {
    skip: isVerifyTokenSkip
  })
  const refreshToken = useRefreshToken()

  useEffect(() => {
    if (token) {
      if (isJwtExpired(token)) {
        refreshToken()
      } else {
        dispatch(appSlice.actions.setToken(token))
        setIsVerifyTokenSkip(false)
      }
    }
  }, [])

  useEffect(() => {
    if (verifyTokenQuery.isLoading) {
      setIsVerifyTokenSkip(true)
    }
  }, [verifyTokenQuery.isLoading])
}

export function useToken() {
  return useAppSelector((state) => state.appReducer.token)
}

export function useSocket() {
  return useAppSelector((state) => state.appReducer.socket)
}

export function useSocketServer() {
  const token = useToken()
  const dispatch = useAppDispatch()
  const isRefreshLocked = useRef(false)
  const lastEvent = useRef<{ event: string; data: any[] } | null>(null)

  async function connectSocketServer(token: string) {
    if (!token) {
      return
    }

    const socket = io(API_URL, {
      withCredentials: true,
      reconnectionDelay: 1000,
      auth: {
        token
      }
    })

    const handleUnauthorized = async () => {
      if (isRefreshLocked.current) {
        return
      }

      isRefreshLocked.current = true

      try {
        // Refresh the access token
        const response = await axios.get(`${API_URL}/api/public/auth/refresh`, {
          withCredentials: true
        })
        const token = response.data.result

        if (token) {
          dispatch(appSlice.actions.setToken(token))

          // Update socket auth token and reconnect
          socket.auth = {
            token
          }
          socket.connect()

          // Retry the original event with the new token
          if (lastEvent.current) {
            socket.emit(lastEvent.current.event, ...lastEvent.current.data)
          }
        }

        isRefreshLocked.current = false
      } catch (err) {
        console.error('Failed to refresh token:', err)
        socket.disconnect()
      }
    }

    socket.on('unauthorized', handleUnauthorized)
    // The server rejects an expired token during the handshake instead of letting the connection through
    socket.on('connect_error', (err) => {
      if (err.message === SOCKET_TOKEN_EXPIRED) {
        handleUnauthorized()
      }
    })

    dispatch(appSlice.actions.setSocket(socket))
  }

  useEffect(() => {
    if (token) {
      connectSocketServer(token)
    }
  }, [token])
}
