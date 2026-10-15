import { IAuthTokenResponse } from '@lib/utils/interfaces/auth'
import { BaseQueryFn, FetchArgs, fetchBaseQuery, FetchBaseQueryError } from '@reduxjs/toolkit/query/react'
import { API_URL } from '../config'
import { clearViewAs, readViewAs } from '../../features/viewas/view-as-storage'
import { isJwtExpired } from '../jwt'
import { refreshOnce } from './refresh'
import { setToken } from './session.slice'
import type { RootState } from '.'

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).session.token

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  }
})

// Refreshes an expired access token before the request; ends the session when the refresh fails
export const baseQueryWithRefresh: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const token = (api.getState() as RootState).session.token

  if (token && isJwtExpired(token)) {
    if (readViewAs()) {
      // A view has no refresh token: it simply ends, and the admin's own session is left alone
      api.dispatch(setToken(null))
      clearViewAs()
      return await baseQuery(args, api, extraOptions)
    }
    const refreshed = await refreshOnce(async () => {
      const result = (await baseQuery({ url: '/api/v1/auth/refresh', method: 'POST' }, api, extraOptions)) as {
        data?: IAuthTokenResponse
      }

      return result.data?.accessToken ?? null
    })

    if (refreshed) {
      api.dispatch(setToken(refreshed))
    } else {
      await baseQuery(
        { url: '/api/v1/auth/logout', method: 'POST', responseHandler: 'content-type' },
        api,
        extraOptions
      )
      api.dispatch(setToken(null))
    }
  }

  return await baseQuery(args, api, extraOptions)
}
