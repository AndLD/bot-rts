import { createApi, FetchBaseQueryError, retry } from '@reduxjs/toolkit/query/react'
import { baseQueryWithRefresh } from '../store/baseQuery'

// 'Bases': the bases of the player; 'Storage': what the bots carry; 'Factory': the jobs and parts of a base; 'Settings': the settings of the game and of the player; 'Tutorial': the checklist of the player; 'Recipes': which recipes the player knows; 'Achievements': what the player has earned; 'Notifications': the notification center; 'NotificationPreferences': which categories the player hears about; 'ApiKeys': the API keys of the player; 'AdminMe': who the admin is and the state of the second factor; 'Monitoring': the health report and the alerts of the admin console; 'Players': the players of the admin console
export const API_TAGS = [
  'Bases',
  'Storage',
  'Factory',
  'Settings',
  'Tutorial',
  'Recipes',
  'Achievements',
  'Notifications',
  'NotificationPreferences',
  'ApiKeys',
  'AdminMe',
  'Monitoring',
  'Players'
] as const

const MAX_RETRIES = 3

// A read that never reached the server (it is down, or the network dropped) is tried again with a growing pause; a request that
// changes something is never repeated, because it may have been done, and a refused request is an answer, not a failure to retry
const baseQueryWithRetry = retry(baseQueryWithRefresh, {
  retryCondition: (error, args, { attempt }) =>
    attempt <= MAX_RETRIES &&
    (error as FetchBaseQueryError).status === 'FETCH_ERROR' &&
    (typeof args === 'string' || (args.method ?? 'GET').toUpperCase() === 'GET')
})

// The one RTK Query API of the client. Its endpoints are generated from the OpenAPI document of the API (generated.ts);
// run `npm run api:generate -w client` after the API changes.
export const emptyApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: [...API_TAGS],
  // Back online after the network dropped: what is on screen is read again
  refetchOnReconnect: true,
  endpoints: () => ({})
})
