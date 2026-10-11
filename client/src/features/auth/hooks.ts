import { useCallback, useEffect } from 'react'
import { ErrorCode } from '@lib/utils/error-codes'
import { IUserInfo } from '@lib/utils/interfaces/users'
import { skipToken } from '@reduxjs/toolkit/query'
import { errorNotification } from '../../shared/notifications'
import { refreshOnce } from '../../shared/store/refresh'
import { setToken } from '../../shared/store/session.slice'
import { useAppDispatch, useToken } from '../../shared/store/hooks'
import { useGetMeQuery, useLogoutMutation, useRefreshTokenMutation, useVerifyEmailMutation } from './auth.api'

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
      dispatch(setToken(null))
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

// Signs the player out on the server and locally
export function useLogout() {
  const dispatch = useAppDispatch()
  const [logout] = useLogoutMutation()

  return useCallback(
    async (afterLogout?: () => void) => {
      const result = await logout()

      if ('error' in result) {
        errorNotification('Could not sign out', 'Error')
      }

      dispatch(setToken(null))
      afterLogout?.()
    },
    [dispatch, logout]
  )
}

// Exchanges the refresh cookie for a new access token; resolves to the token, or null when the session is over
export function useRefreshSession() {
  const dispatch = useAppDispatch()
  const [refresh] = useRefreshTokenMutation()

  return useCallback(async () => {
    const token = await refreshOnce(async () => {
      const result = await refresh()

      return result.data?.accessToken ?? null
    })

    dispatch(setToken(token))

    return token
  }, [dispatch, refresh])
}

// Confirms the email with the token of the emailed link and then calls `onDone`, whatever the outcome
export function useVerifyEmail(token: string | null, onDone: () => void) {
  const [verifyEmail] = useVerifyEmailMutation()

  useEffect(() => {
    if (!token) {
      return
    }

    verifyEmail({ token }).then((result) => {
      if ('error' in result) {
        errorNotification('Email confirmation failed')
      }
      onDone()
    })
    // The link is confirmed once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
}
