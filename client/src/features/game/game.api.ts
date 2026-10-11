import { createApi } from '@reduxjs/toolkit/query/react'
import { IBot } from '@lib/utils/interfaces/bots'
import { baseQueryWithRefresh } from '../../shared/store/baseQuery'

export const gameApi = createApi({
  reducerPath: 'gameApi',
  baseQuery: baseQueryWithRefresh,
  tagTypes: ['Bases'],
  endpoints: (builder) => ({
    // The token is the cache key, so a new login never shows the bases of the previous player
    getBases: builder.query<IBot[], string>({
      query: () => ({ url: '/api/v1/bots?type=base' }),
      providesTags: ['Bases']
    }),
    // Deploys the first base of the player with its access password (design §5, §11.2.2)
    deployBase: builder.mutation<unknown, { password: string }>({
      query: (body) => ({ method: 'POST', url: '/api/v1/bots/base', body }),
      invalidatesTags: ['Bases']
    })
  })
})

export const { useGetBasesQuery, useDeployBaseMutation } = gameApi
