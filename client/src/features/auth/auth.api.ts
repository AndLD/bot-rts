import { createApi } from '@reduxjs/toolkit/query/react'
import { IAuthPostBody, IAuthTokenResponse } from '@lib/utils/interfaces/auth'
import { IUserInfo, IUserPostBody } from '@lib/utils/interfaces/users'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithRefresh,
  endpoints: (builder) => ({
    // The access token only identifies the session. The token is the cache key, so a new login never shows the
    // previous player.
    getMe: builder.query<IUserInfo, string>({
      query: () => ({ url: '/api/v1/users/me' })
    }),
    register: builder.mutation<IAuthTokenResponse, IUserPostBody>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/register', body })
    }),
    login: builder.mutation<IAuthTokenResponse, IAuthPostBody>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/login', body })
    }),
    refreshToken: builder.mutation<IAuthTokenResponse, void>({
      query: () => ({ method: 'POST', url: '/api/v1/auth/refresh' })
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ method: 'POST', url: '/api/v1/auth/logout', responseHandler: 'content-type' })
    }),
    verifyEmail: builder.mutation<void, { token: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/email/verify', body, responseHandler: 'content-type' })
    }),
    resendVerification: builder.mutation<void, { email: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/email/resend', body, responseHandler: 'content-type' })
    }),
    requestPasswordReset: builder.mutation<void, { email: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/password/forgot', body, responseHandler: 'content-type' })
    }),
    resetPassword: builder.mutation<void, { token: string; password: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/password/reset', body, responseHandler: 'content-type' })
    }),
    changePassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/password/change', body, responseHandler: 'content-type' })
    }),
    requestEmailChange: builder.mutation<void, { password: string; newEmail: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/email/change', body, responseHandler: 'content-type' })
    }),
    confirmEmailChange: builder.mutation<void, { token: string }>({
      query: (body) => ({
        method: 'POST',
        url: '/api/v1/auth/email/change/confirm',
        body,
        responseHandler: 'content-type'
      })
    }),
    requestAccountDeletion: builder.mutation<void, { password: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/account/delete', body, responseHandler: 'content-type' })
    }),
    confirmAccountDeletion: builder.mutation<void, { token: string }>({
      query: (body) => ({
        method: 'POST',
        url: '/api/v1/auth/account/delete/confirm',
        body,
        responseHandler: 'content-type'
      })
    })
  })
})

export const { useGetMeQuery } = authApi
