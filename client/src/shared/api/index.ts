import { api as generated } from './generated'

// The generated API with what the OpenAPI document cannot say: which requests make others stale
export const api = generated.enhanceEndpoints({
  endpoints: {
    // Deploying a base changes the list of the player's bases, which decides between the deploy screen and the terminal
    botsList: { providesTags: ['Bases'] },
    botsDeployBase: { invalidatesTags: ['Bases'] }
  }
})

export const { useBotsDeployBaseMutation, useBotsListQuery, useMapPositionQuery, useUsersMeQuery } = api
