import { useEffect, useRef } from 'react'
import { appSlice } from '../store/app.reducer'
import { skipToken } from '@reduxjs/toolkit/query'
import { ErrorCode } from '@lib/utils/error-codes'
import { IUserInfo } from '@lib/utils/interfaces/users'
import { useGetMeQuery } from '../store/auth.api.ts'
import { useAppDispatch, useAppSelector } from './store'
import { API_URL } from '../utils/constants.ts'
import { io } from 'socket.io-client'
import axios from 'axios'
import { SOCKET_TOKEN_EXPIRED } from '@lib/utils/constants'

export type CurrentUser =
  { state: 'anonymous' | 'loading' | 'unverified' | 'blocked' } | { state: 'active'; user: IUserInfo }

interface ApiErrorBody {
  status?: number
  data?: { code?: string }
}

// The player behind the access token, as the server sees them right now
export function useCurrentUser(): CurrentUser {
  const dispatch = useAppDispatch()
  const token = useToken()
  const { data, error, isLoading } = useGetMeQuery(token ?? skipToken)
  const failure = error as ApiErrorBody | undefined
  const isTokenRejected = failure?.status === 401

  useEffect(() => {
    if (isTokenRejected) {
      dispatch(appSlice.actions.setToken(null))
    }
  }, [isTokenRejected, dispatch])

  if (!token || isTokenRejected) {
    return { state: 'anonymous' }
  }
  if (data) {
    return { state: 'active', user: data }
  }
  if (failure?.data?.code === ErrorCode.EMAIL_NOT_VERIFIED) {
    return { state: 'unverified' }
  }
  if (failure?.data?.code === ErrorCode.USER_BANNED) {
    return { state: 'blocked' }
  }

  return { state: isLoading ? 'loading' : 'anonymous' }
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
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, undefined, { withCredentials: true })
        const token = response.data.accessToken

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
