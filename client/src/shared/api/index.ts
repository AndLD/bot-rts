import { api as generated } from './generated'

// The generated API with what the OpenAPI document cannot say: which requests make others stale
export const api = generated.enhanceEndpoints({
  endpoints: {
    // Deploying a base changes the list of the player's bases, which decides between the deploy screen and the terminal
    botsList: { providesTags: ['Bases'] },
    botsDeployBase: { invalidatesTags: ['Bases'] },
    // A manual action may change what a bot carries
    // Crafting spends the resources of the base and changes the jobs; assembling also adds a bot
    factoryStatus: { providesTags: ['Factory'] },
    factoryCraft: { invalidatesTags: ['Factory', 'Storage'] },
    factoryResearch: { invalidatesTags: ['Factory', 'Storage'] },
    factoryLearn: { invalidatesTags: ['Factory'] },
    factoryAssemble: { invalidatesTags: ['Factory', 'Bases'] },
    botControlGetStorage: { providesTags: ['Storage'] },
    botControlPerform: { invalidatesTags: ['Storage'] }
  }
})

export const {
  useBotControlGetStorageQuery,
  useBotControlPerformMutation,
  useBotsDeployBaseMutation,
  useBotsListQuery,
  useCraftingRecipeListQuery,
  useFactoryAssembleMutation,
  useFactoryCraftMutation,
  useFactoryLearnMutation,
  useFactoryResearchMutation,
  useFactoryStatusQuery,
  useMapPositionQuery,
  useUsersMeQuery
} = api
