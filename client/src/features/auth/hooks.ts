import { useCallback, useEffect, useRef } from 'react'
import { ErrorCode } from '@lib/utils/error-codes'
import { IUserInfo } from '@lib/utils/interfaces/users'
import { skipToken } from '@reduxjs/toolkit/query'
import { useTranslations } from 'next-intl'
import { errorNotification } from '../../shared/notifications'
import { setToken } from '../../shared/store/session.slice'
import { useAppDispatch, useToken } from '../../shared/store/hooks'
import { useGetMeQuery } from './auth.api'
import { useAuth } from './auth-client-context'

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

// Signs the player out on the server and locally, then calls `afterLogout`
export function useLogout() {
  const auth = useAuth()

  return useCallback(
    async (afterLogout?: () => void) => {
      await auth.signOut()
      afterLogout?.()
    },
    [auth]
  )
}

// Exchanges the refresh cookie for a new access token; resolves to the token, or null when the session is over
export function useRefreshSession() {
  const auth = useAuth()

  return useCallback(() => auth.refresh(), [auth])
}

// Confirms the email with the token of the emailed link and then calls `onDone`, whatever the outcome
export function useVerifyEmail(token: string | null, onDone: () => void) {
  const t = useTranslations('auth')
  const auth = useAuth()
  // A link works once, so it must be sent once even when React runs the effect twice in development
  const verifiedToken = useRef<string | null>(null)

  useEffect(() => {
    if (!token || verifiedToken.current === token) {
      return
    }
    verifiedToken.current = token

    auth.verifyEmail(token).then((result) => {
      if (!result.ok) {
        errorNotification(t('verificationFailed'))
      }
      onDone()
    })
    // The link is confirmed once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
}
