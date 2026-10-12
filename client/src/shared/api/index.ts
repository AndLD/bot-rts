import { api as generated } from './generated'

// The generated API with what the OpenAPI document cannot say: which requests make others stale
export const api = generated.enhanceEndpoints({
  endpoints: {
    // Deploying a base changes the list of the player's bases, which decides between the deploy screen and the terminal
    botsList: { providesTags: ['Bases'] },
    botsDeployBase: { invalidatesTags: ['Bases'] },
    // A manual action may change what a bot carries
    botControlGetStorage: { providesTags: ['Storage'] },
    botControlPerform: { invalidatesTags: ['Storage'] }
  }
})

export const {
  useBotControlGetStorageQuery,
  useBotControlPerformMutation,
  useBotsDeployBaseMutation,
  useBotsListQuery,
  useMapPositionQuery,
  useUsersMeQuery
} = api
