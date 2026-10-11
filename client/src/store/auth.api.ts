import { createApi } from '@reduxjs/toolkit/query/react'
import { IAuthPostBody, IAuthTokenResponse } from '@lib/utils/interfaces/auth'
import { IUserInfo } from '@lib/utils/interfaces/users'
import { baseQueryWithRefresh } from '../utils/store'

export const authApi = createApi({
  reducerPath: 'auth/api',
  baseQuery: baseQueryWithRefresh,
  endpoints: (builder) => ({
    // The access token only identifies the session; who the player is comes from the server. The token is the cache key,
    // so a new login never shows the previous player.
    getMe: builder.query<IUserInfo, string>({
      query: () => ({
        url: '/api/v1/users/me'
      })
    }),
    refreshToken: builder.mutation<IAuthTokenResponse, void>({
      query: () => ({
        method: 'POST',
        url: '/api/v1/auth/refresh'
      })
    }),
    login: builder.mutation<IAuthTokenResponse, IAuthPostBody>({
      query: (body: IAuthPostBody) => ({
        method: 'POST',
        url: '/api/v1/auth/login',
        body
      })
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        method: 'POST',
        url: '/api/v1/auth/logout',
        responseHandler: 'text'
      })
    })
  })
})

export const { useGetMeQuery, useRefreshTokenMutation, useLoginMutation, useLogoutMutation } = authApi
