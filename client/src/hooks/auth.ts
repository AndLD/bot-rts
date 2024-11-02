import { useEffect, useRef, useState } from 'react'
import { appSlice } from '../store/app.reducer'
import { useVerifyTokenQuery } from '../store/auth.api.ts'
import { isJwtExpired } from '../utils/jwt'
import { useAppDispatch, useAppSelector } from './store'
import { useRefreshToken } from './store/auth.api'
import { API_URL } from '../utils/constants.ts'
import { io } from 'socket.io-client'
import axios from 'axios'

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

    socket.on('unauthorized', async () => {
      console.log(
        `[debug] Access token expired${lastEvent.current && ` for event ${lastEvent.current.event}`}, refreshing token...`
      )

      if (isRefreshLocked.current) {
        console.log('Refresh is locked')
        return
      }

      isRefreshLocked.current = true

      try {
        // Refresh the access token
        const response = await axios.get('http://localhost:8080/api/public/auth/refresh', {
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

            console.log('[debug] Retried event with refreshed token:', lastEvent.current)
          }
        }

        isRefreshLocked.current = false
      } catch (err) {
        console.error('Failed to refresh token:', err)
        socket.disconnect()
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
