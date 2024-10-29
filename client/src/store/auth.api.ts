import { createApi } from '@reduxjs/toolkit/query/react'
import { IAuthPostBody, IAuthPostResponse, IRefreshPostResponse } from '../utils/interfaces/auth'
import { baseQueryWithRefresh } from '../utils/store'

export const authApi = createApi({
  reducerPath: 'auth/api',
  baseQuery: baseQueryWithRefresh,
  endpoints: (builder) => ({
    verifyToken: builder.query<any, void>({
      query: () => ({
        url: '/api/private/auth/verify'
      })
    }),
    refreshToken: builder.mutation<IRefreshPostResponse, void>({
      query: () => ({
        method: 'GET',
        url: '/api/public/auth/refresh'
      })
    }),
    login: builder.mutation<IAuthPostResponse, IAuthPostBody>({
      query: (body: IAuthPostBody) => ({
        method: 'POST',
        url: '/api/public/auth/login',
        body
      })
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        method: 'POST',
        url: '/api/public/auth/logout',
        responseHandler: 'text'
      })
    })
  })
})

export const { useVerifyTokenQuery, useRefreshTokenMutation, useLoginMutation, useLogoutMutation } = authApi
