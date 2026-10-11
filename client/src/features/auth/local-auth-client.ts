import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { refreshOnce } from '../../shared/store/refresh'
import { setToken } from '../../shared/store/session.slice'
import type { AppStore } from '../../shared/store'
import { authApi } from './auth.api'
import { AuthClient, AuthFailure, AuthResult } from './auth-client'

interface ApiErrorBody {
  code?: string
  error?: string
}

function toFailure(error: unknown): AuthFailure {
  const body = (error as FetchBaseQueryError | SerializedError | undefined) && (error as FetchBaseQueryError).data
  const { code, error: message } = (body ?? {}) as ApiErrorBody

  return { code, message }
}

// The client of our own identity provider: the `/api/v1/auth/*` endpoints through RTK Query, with the access token kept
// in the session slice and the refresh token in an HTTP-only cookie
export function createLocalAuthClient(store: AppStore): AuthClient {
  const { endpoints } = authApi

  async function attempt(call: () => Promise<unknown>): Promise<AuthResult> {
    try {
      await call()
      return { ok: true }
    } catch (error) {
      return { ok: false, failure: toFailure(error) }
    }
  }

  const startSession = async (token: string) => {
    store.dispatch(setToken(token))
  }

  return {
    signIn: (credentials) =>
      attempt(async () =>
        startSession((await store.dispatch(endpoints.login.initiate(credentials)).unwrap()).accessToken)
      ),

    signUp: (registration) =>
      attempt(async () =>
        startSession((await store.dispatch(endpoints.register.initiate(registration)).unwrap()).accessToken)
      ),

    async signOut() {
      await store
        .dispatch(endpoints.logout.initiate())
        .unwrap()
        .catch(() => undefined)
      store.dispatch(setToken(null))
    },

    async refresh() {
      const token = await refreshOnce(async () => {
        try {
          return (await store.dispatch(endpoints.refreshToken.initiate()).unwrap()).accessToken
        } catch {
          return null
        }
      })

      store.dispatch(setToken(token))

      return token
    },

    verifyEmail: (token) => attempt(() => store.dispatch(endpoints.verifyEmail.initiate({ token })).unwrap()),
    resendVerification: (email) =>
      attempt(() => store.dispatch(endpoints.resendVerification.initiate({ email })).unwrap()),
    requestPasswordReset: (email) =>
      attempt(() => store.dispatch(endpoints.requestPasswordReset.initiate({ email })).unwrap()),
    resetPassword: (token, password) =>
      attempt(() => store.dispatch(endpoints.resetPassword.initiate({ token, password })).unwrap()),
    changePassword: (currentPassword, newPassword) =>
      attempt(() => store.dispatch(endpoints.changePassword.initiate({ currentPassword, newPassword })).unwrap()),
    requestEmailChange: (password, newEmail) =>
      attempt(() => store.dispatch(endpoints.requestEmailChange.initiate({ password, newEmail })).unwrap()),
    confirmEmailChange: (token) =>
      attempt(() => store.dispatch(endpoints.confirmEmailChange.initiate({ token })).unwrap()),
    requestAccountDeletion: (password) =>
      attempt(() => store.dispatch(endpoints.requestAccountDeletion.initiate({ password })).unwrap()),
    confirmAccountDeletion: (token) =>
      attempt(() => store.dispatch(endpoints.confirmAccountDeletion.initiate({ token })).unwrap())
  }
}
