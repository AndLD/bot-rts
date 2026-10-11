import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  IFetchUsersResponse,
  IUsersFilter,
  IUserPostBody,
  IUserPostResponse,
  IUserPutBody,
  IUserPutResponse
} from '@lib/utils/interfaces/users'
import { baseQueryWithRefresh } from '../utils/store'
import { API_URL } from '../utils/constants'

export const privateUsersApi = createApi({
  reducerPath: '/api/private/users',
  baseQuery: baseQueryWithRefresh,
  endpoints: (builder) => ({
    putUser: builder.mutation<IUserPutResponse, { id: string; body: IUserPutBody }>({
      query: ({ id, body }) => ({
        method: 'PUT',
        url: `/api/private/users/${id}`,
        body
      })
    }),
    fetchUsers: builder.query<
      IFetchUsersResponse,
      {
        pagination: { current: number; pageSize: number }
        filter?: IUsersFilter
      }
    >({
      query: ({ pagination, filter }) => ({
        url: '/api/private/users',
        params: {
          page: pagination.current,
          results: pagination.pageSize,
          ...filter
        }
      })
    })
  })
})

export const publicUsersApi = createApi({
  reducerPath: '/api/public/users',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    credentials: 'include'
  }),
  endpoints: (builder) => ({
    fetchVerifyEmail: builder.query<void, { emailVerificationToken: string | null }>({
      query: ({ emailVerificationToken }) => ({
        url: '/api/public/users/verify',
        params: {
          token: emailVerificationToken
        },
        responseHandler: 'text'
      })
    }),
    postUser: builder.mutation<IUserPostResponse, IUserPostBody>({
      query: (body) => ({
        method: 'POST',
        url: '/api/public/users',
        body
      })
    })
  })
})

export const { useFetchUsersQuery, usePutUserMutation } = privateUsersApi
export const { useFetchVerifyEmailQuery, usePostUserMutation } = publicUsersApi
