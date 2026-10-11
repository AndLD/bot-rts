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
      query: () => ({ method: 'POST', url: '/api/v1/auth/logout', responseHandler: 'text' })
    }),
    verifyEmail: builder.mutation<void, { token: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/auth/email/verify', body, responseHandler: 'text' })
    })
  })
})

export const {
  useGetMeQuery,
  useRegisterMutation,
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useVerifyEmailMutation
} = authApi
