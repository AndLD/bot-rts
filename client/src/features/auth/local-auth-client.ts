import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { readViewAs } from '../viewas/view-as-storage'
import { refreshOnce } from '../../shared/store/refresh'
import { setToken } from '../../shared/store/session.slice'
import type { AppStore } from '../../shared/store'
import { api } from '../../shared/api'
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
  const { endpoints } = api

  async function attempt(call: () => Promise<unknown>): Promise<AuthResult> {
    try {
      await call()
      return { ok: true }
    } catch (error) {
      return { ok: false, failure: toFailure(error) }
    }
  }

  // A new login never sees what the previous player left in the cache
  const startSession = async (token: string) => {
    store.dispatch(api.util.resetApiState())
    store.dispatch(setToken(token))
  }

  return {
    signIn: (credentials) =>
      attempt(async () =>
        startSession(
          (await store.dispatch(endpoints.authLogin.initiate({ loginDto: credentials })).unwrap()).accessToken
        )
      ),

    signUp: (registration) =>
      attempt(async () =>
        startSession(
          (await store.dispatch(endpoints.authRegister.initiate({ registerDto: registration })).unwrap()).accessToken
        )
      ),

    async signOut() {
      await store
        .dispatch(endpoints.authLogout.initiate())
        .unwrap()
        .catch(() => undefined)
      store.dispatch(api.util.resetApiState())
      store.dispatch(setToken(null))
    },

    async refresh() {
      // The cookie belongs to the admin's own session, which a view must never take over
      if (readViewAs()) {
        return null
      }
      const token = await refreshOnce(async () => {
        try {
          return (await store.dispatch(endpoints.authRefresh.initiate()).unwrap()).accessToken
        } catch {
          return null
        }
      })

      store.dispatch(setToken(token))

      return token
    },

    verifyEmail: (token) =>
      attempt(() => store.dispatch(endpoints.authVerifyEmail.initiate({ tokenDto: { token } })).unwrap()),
    resendVerification: (email) =>
      attempt(() => store.dispatch(endpoints.authResendVerification.initiate({ emailDto: { email } })).unwrap()),
    requestPasswordReset: (email) =>
      attempt(() => store.dispatch(endpoints.authForgotPassword.initiate({ emailDto: { email } })).unwrap()),
    resetPassword: (token, password) =>
      attempt(() =>
        store.dispatch(endpoints.authResetPassword.initiate({ resetPasswordDto: { token, password } })).unwrap()
      ),
    changePassword: (currentPassword, newPassword) =>
      attempt(() =>
        store
          .dispatch(endpoints.authChangePassword.initiate({ changePasswordDto: { currentPassword, newPassword } }))
          .unwrap()
      ),
    requestEmailChange: (password, newEmail) =>
      attempt(() =>
        store.dispatch(endpoints.authRequestEmailChange.initiate({ changeEmailDto: { password, newEmail } })).unwrap()
      ),
    confirmEmailChange: (token) =>
      attempt(() => store.dispatch(endpoints.authConfirmEmailChange.initiate({ tokenDto: { token } })).unwrap()),
    requestAccountDeletion: (password) =>
      attempt(() =>
        store.dispatch(endpoints.authRequestAccountDeletion.initiate({ passwordDto: { password } })).unwrap()
      ),
    confirmAccountDeletion: (token) =>
      attempt(() => store.dispatch(endpoints.authConfirmAccountDeletion.initiate({ tokenDto: { token } })).unwrap())
  }
}
