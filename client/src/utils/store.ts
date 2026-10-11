import { BaseQueryApi, BaseQueryExtraOptions, BaseQueryFn } from '@reduxjs/toolkit/dist/query/baseQueryTypes'
import { FetchArgs, fetchBaseQuery, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { RootState } from '../store'
import { appSlice } from '../store/app.reducer'
import { IAuthTokenResponse } from '@lib/utils/interfaces/auth'
import { isJwtExpired } from './jwt'
import { API_URL } from './constants'

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).appReducer.token

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  }
})

export const baseQueryWithRefresh: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args: string | FetchArgs,
  api: BaseQueryApi,
  extraOptions: BaseQueryExtraOptions<typeof baseQuery>
) => {
  const token = (api.getState() as RootState).appReducer.token

  if (token && isJwtExpired(token)) {
    // Try to refresh token
    const refreshResult = (await baseQuery({ url: '/api/v1/auth/refresh', method: 'POST' }, api, extraOptions)) as {
      data?: IAuthTokenResponse
    }

    const token = refreshResult?.data?.accessToken

    if (token) {
      // Store new access token
      api.dispatch(appSlice.actions.setToken(token))
    } else {
      await baseQuery({ url: '/api/v1/auth/logout', method: 'POST', responseHandler: 'text' }, api, extraOptions)
      api.dispatch(appSlice.actions.setToken(null))
    }
  }

  return await baseQuery(args, api, extraOptions)
}
