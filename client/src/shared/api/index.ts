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
    factoryLearn: { invalidatesTags: ['Factory', 'Recipes'] },
    // What the player knows of the recipes changes when a blueprint is learned or research ends
    craftingRecipeList: { providesTags: ['Recipes'] },
    factoryAssemble: { invalidatesTags: ['Factory', 'Bases'] },
    // The settings of the player depend on those of the game, so a change of either makes both stale
    settingsGet: { providesTags: ['Settings'] },
    settingsUpdate: { invalidatesTags: ['Settings'] },
    adminSettingsGet: { providesTags: ['Settings'] },
    adminSettingsUpdate: { invalidatesTags: ['Settings'] },
    // An unlock pushed over the socket makes the list stale
    achievementsList: { providesTags: ['Achievements'] },
    notificationsList: { providesTags: ['Notifications'] },
    notificationsSummary: { providesTags: ['Notifications'] },
    notificationsMarkRead: { invalidatesTags: ['Notifications'] },
    notificationsPreferences: { providesTags: ['NotificationPreferences'] },
    notificationsUpdatePreferences: { invalidatesTags: ['NotificationPreferences'] },
    apiKeysList: { providesTags: ['ApiKeys'] },
    apiKeysCreate: { invalidatesTags: ['ApiKeys'] },
    apiKeysRevoke: { invalidatesTags: ['ApiKeys'] },
    adminMe: { providesTags: ['AdminMe'] },
    adminVerify: { invalidatesTags: ['AdminMe'] },
    tutorialGet: { providesTags: ['Tutorial'] },
    tutorialSkip: { invalidatesTags: ['Tutorial'] },
    tutorialRestart: { invalidatesTags: ['Tutorial'] },
    botControlGetStorage: { providesTags: ['Storage'] },
    botControlPerform: { invalidatesTags: ['Storage'] }
  }
})

export const {
  useAdminMeQuery,
  useAdminEnrollMutation,
  useAdminConfirmMutation,
  useAdminVerifyMutation,
  useApiKeysCreateMutation,
  useApiKeysListQuery,
  useApiKeysRevokeMutation,
  useLazyNotificationsListQuery,
  useNotificationsListQuery,
  useNotificationsMarkReadMutation,
  useNotificationsPreferencesQuery,
  useNotificationsSummaryQuery,
  useNotificationsUpdatePreferencesMutation,
  useAchievementsListQuery,
  useAdminSettingsUpdateMutation,
  useSettingsGetQuery,
  useTutorialGetQuery,
  useGameTimeCurrentQuery,
  useTutorialRestartMutation,
  useTutorialSkipMutation,
  useSettingsUpdateMutation,
  useBotControlGetStorageQuery,
  useBotControlPerformMutation,
  useBotsDeployBaseMutation,
  useBotsListQuery,
  useBotsModulesQuery,
  useCraftingRecipeListQuery,
  useFactoryAssembleMutation,
  useFactoryCraftMutation,
  useFactoryLearnMutation,
  useFactoryResearchMutation,
  useFactoryStatusQuery,
  useMapPositionQuery,
  useUsersMeQuery
} = api
