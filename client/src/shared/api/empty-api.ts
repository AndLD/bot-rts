import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithRefresh } from '../store/baseQuery'

// The one RTK Query API of the client. Its endpoints are generated from the OpenAPI document of the API (generated.ts);
// run `npm run api:generate -w client` after the API changes.
export const emptyApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRefresh,
  // 'Bases': the bases of the player; 'Storage': what the bots carry; 'Factory': the jobs and parts of a base; 'Settings': the settings of the game and of the player; 'Tutorial': the checklist of the player; 'Recipes': which recipes the player knows; 'Achievements': what the player has earned
  tagTypes: ['Bases', 'Storage', 'Factory', 'Settings', 'Tutorial', 'Recipes', 'Achievements'],
  endpoints: () => ({})
})
