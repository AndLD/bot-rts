import { emptyApi as api } from './empty-api'
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    usersMe: build.query<UsersMeApiResponse, UsersMeApiArg>({
      query: () => ({ url: `/api/v1/users/me` })
    }),
    usersList: build.query<UsersListApiResponse, UsersListApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/users`,
        params: {
          page: queryArg.page,
          results: queryArg.results,
          status: queryArg.status,
          active: queryArg.active,
          email: queryArg.email
        }
      })
    }),
    usersUpdate: build.mutation<UsersUpdateApiResponse, UsersUpdateApiArg>({
      query: (queryArg) => ({ url: `/api/v1/users/${queryArg.id}`, method: 'PUT', body: queryArg.updateUserDto })
    }),
    authRegister: build.mutation<AuthRegisterApiResponse, AuthRegisterApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/register`, method: 'POST', body: queryArg.registerDto })
    }),
    authLogin: build.mutation<AuthLoginApiResponse, AuthLoginApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/login`, method: 'POST', body: queryArg.loginDto })
    }),
    authRefresh: build.mutation<AuthRefreshApiResponse, AuthRefreshApiArg>({
      query: () => ({ url: `/api/v1/auth/refresh`, method: 'POST' })
    }),
    authLogout: build.mutation<AuthLogoutApiResponse, AuthLogoutApiArg>({
      query: () => ({ url: `/api/v1/auth/logout`, method: 'POST' })
    }),
    authVerifyEmail: build.mutation<AuthVerifyEmailApiResponse, AuthVerifyEmailApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/email/verify`, method: 'POST', body: queryArg.tokenDto })
    }),
    authResendVerification: build.mutation<AuthResendVerificationApiResponse, AuthResendVerificationApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/email/resend`, method: 'POST', body: queryArg.emailDto })
    }),
    authForgotPassword: build.mutation<AuthForgotPasswordApiResponse, AuthForgotPasswordApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/password/forgot`, method: 'POST', body: queryArg.emailDto })
    }),
    authResetPassword: build.mutation<AuthResetPasswordApiResponse, AuthResetPasswordApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/password/reset`, method: 'POST', body: queryArg.resetPasswordDto })
    }),
    authChangePassword: build.mutation<AuthChangePasswordApiResponse, AuthChangePasswordApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/password/change`, method: 'POST', body: queryArg.changePasswordDto })
    }),
    authRequestEmailChange: build.mutation<AuthRequestEmailChangeApiResponse, AuthRequestEmailChangeApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/email/change`, method: 'POST', body: queryArg.changeEmailDto })
    }),
    authConfirmEmailChange: build.mutation<AuthConfirmEmailChangeApiResponse, AuthConfirmEmailChangeApiArg>({
      query: (queryArg) => ({ url: `/api/v1/auth/email/change/confirm`, method: 'POST', body: queryArg.tokenDto })
    }),
    authRequestAccountDeletion: build.mutation<AuthRequestAccountDeletionApiResponse, AuthRequestAccountDeletionApiArg>(
      {
        query: (queryArg) => ({ url: `/api/v1/auth/account/delete`, method: 'POST', body: queryArg.passwordDto })
      }
    ),
    authConfirmAccountDeletion: build.mutation<AuthConfirmAccountDeletionApiResponse, AuthConfirmAccountDeletionApiArg>(
      {
        query: (queryArg) => ({ url: `/api/v1/auth/account/delete/confirm`, method: 'POST', body: queryArg.tokenDto })
      }
    ),
    adminMe: build.query<AdminMeApiResponse, AdminMeApiArg>({
      query: () => ({ url: `/api/v1/admin/me` })
    }),
    adminEnroll: build.mutation<AdminEnrollApiResponse, AdminEnrollApiArg>({
      query: () => ({ url: `/api/v1/admin/2fa/enroll`, method: 'POST' })
    }),
    adminConfirm: build.mutation<AdminConfirmApiResponse, AdminConfirmApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/2fa/confirm`, method: 'POST', body: queryArg.twoFactorCodeDto })
    }),
    adminVerify: build.mutation<AdminVerifyApiResponse, AdminVerifyApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/2fa/verify`, method: 'POST', body: queryArg.twoFactorCodeDto })
    }),
    auditList: build.query<AuditListApiResponse, AuditListApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/audit`,
        params: {
          page: queryArg.page,
          results: queryArg.results,
          actorId: queryArg.actorId,
          action: queryArg.action,
          targetId: queryArg.targetId,
          outcome: queryArg.outcome,
          from: queryArg['from'],
          to: queryArg.to
        }
      })
    }),
    auditExport: build.query<AuditExportApiResponse, AuditExportApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/audit/export`,
        params: {
          page: queryArg.page,
          results: queryArg.results,
          actorId: queryArg.actorId,
          action: queryArg.action,
          targetId: queryArg.targetId,
          outcome: queryArg.outcome,
          from: queryArg['from'],
          to: queryArg.to
        }
      })
    }),
    playersSearch: build.query<PlayersSearchApiResponse, PlayersSearchApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players`,
        params: {
          page: queryArg.page,
          results: queryArg.results,
          q: queryArg.q,
          status: queryArg.status,
          isEmailVerified: queryArg.isEmailVerified,
          registeredFrom: queryArg.registeredFrom,
          registeredTo: queryArg.registeredTo,
          sort: queryArg.sort,
          order: queryArg.order
        }
      })
    }),
    playersProfile: build.query<PlayersProfileApiResponse, PlayersProfileApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/players/${queryArg.id}` })
    }),
    playersRemove: build.mutation<PlayersRemoveApiResponse, PlayersRemoveApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}`,
        method: 'DELETE',
        body: queryArg.deletePlayerDto
      })
    }),
    playersBan: build.mutation<PlayersBanApiResponse, PlayersBanApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/ban`,
        method: 'POST',
        body: queryArg.banPlayerDto
      })
    }),
    playersUnban: build.mutation<PlayersUnbanApiResponse, PlayersUnbanApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/unban`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    playersLogout: build.mutation<PlayersLogoutApiResponse, PlayersLogoutApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/logout`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    playersResendVerification: build.mutation<PlayersResendVerificationApiResponse, PlayersResendVerificationApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/resend-verification`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    playersResetPassword: build.mutation<PlayersResetPasswordApiResponse, PlayersResetPasswordApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/reset-password`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    playersChangeRole: build.mutation<PlayersChangeRoleApiResponse, PlayersChangeRoleApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/role`,
        method: 'PUT',
        body: queryArg.changeRoleDto
      })
    }),
    playersAddNote: build.mutation<PlayersAddNoteApiResponse, PlayersAddNoteApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/notes`,
        method: 'POST',
        body: queryArg.addNoteDto
      })
    }),
    viewAsStart: build.mutation<ViewAsStartApiResponse, ViewAsStartApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/players/${queryArg.id}/view-as`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    viewAsExit: build.mutation<ViewAsExitApiResponse, ViewAsExitApiArg>({
      query: () => ({ url: `/api/v1/view-as/exit`, method: 'POST' })
    }),
    inspectorSearch: build.query<InspectorSearchApiResponse, InspectorSearchApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/inspector/search`,
        params: {
          q: queryArg.q
        }
      })
    }),
    inspectorBot: build.query<InspectorBotApiResponse, InspectorBotApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/inspector/bots/${queryArg.id}` })
    }),
    inspectorFiles: build.query<InspectorFilesApiResponse, InspectorFilesApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/inspector/bots/${queryArg.id}/drives/${queryArg.driveId}/files`,
        params: {
          dir: queryArg.dir
        }
      })
    }),
    inspectorFile: build.query<InspectorFileApiResponse, InspectorFileApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/inspector/bots/${queryArg.id}/drives/${queryArg.driveId}/file`,
        params: {
          path: queryArg.path
        }
      })
    }),
    inspectorMap: build.query<InspectorMapApiResponse, InspectorMapApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/inspector/map`,
        params: {
          minX: queryArg.minX,
          minY: queryArg.minY,
          maxX: queryArg.maxX,
          maxY: queryArg.maxY
        }
      })
    }),
    inspectorHeatmap: build.query<InspectorHeatmapApiResponse, InspectorHeatmapApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/inspector/heatmap`,
        params: {
          minX: queryArg.minX,
          minY: queryArg.minY,
          maxX: queryArg.maxX,
          maxY: queryArg.maxY,
          kind: queryArg.kind,
          bucket: queryArg.bucket
        }
      })
    }),
    supervisionState: build.query<SupervisionStateApiResponse, SupervisionStateApiArg>({
      query: () => ({ url: `/api/v1/admin/supervision/state` })
    }),
    supervisionKill: build.mutation<SupervisionKillApiResponse, SupervisionKillApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/executions/${queryArg.id}/kill`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    supervisionReboot: build.mutation<SupervisionRebootApiResponse, SupervisionRebootApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/bots/${queryArg.id}/reboot`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    supervisionQuarantine: build.mutation<SupervisionQuarantineApiResponse, SupervisionQuarantineApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/players/${queryArg.id}/quarantine`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    supervisionRelease: build.mutation<SupervisionReleaseApiResponse, SupervisionReleaseApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/players/${queryArg.id}/release`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    supervisionPause: build.mutation<SupervisionPauseApiResponse, SupervisionPauseApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/world/pause`,
        method: 'POST',
        body: queryArg.pauseWorldDto
      })
    }),
    supervisionResume: build.mutation<SupervisionResumeApiResponse, SupervisionResumeApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/supervision/world/resume`, method: 'POST', body: queryArg.reasonDto })
    }),
    supervisionHalt: build.mutation<SupervisionHaltApiResponse, SupervisionHaltApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/scripts/halt`,
        method: 'POST',
        body: queryArg.haltScriptsDto
      })
    }),
    supervisionAllow: build.mutation<SupervisionAllowApiResponse, SupervisionAllowApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/scripts/allow`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    supervisionGrant: build.mutation<SupervisionGrantApiResponse, SupervisionGrantApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/support/grant-resources`,
        method: 'POST',
        body: queryArg.supportResourcesDto
      })
    }),
    supervisionCompensate: build.mutation<SupervisionCompensateApiResponse, SupervisionCompensateApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/support/compensate`,
        method: 'POST',
        body: queryArg.supportResourcesDto
      })
    }),
    supervisionRemove: build.mutation<SupervisionRemoveApiResponse, SupervisionRemoveApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/support/remove-resources`,
        method: 'POST',
        body: queryArg.supportResourcesDto
      })
    }),
    supervisionRestore: build.mutation<SupervisionRestoreApiResponse, SupervisionRestoreApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/supervision/support/restore-module`,
        method: 'POST',
        body: queryArg.restoreModuleDto
      })
    }),
    logsSearch: build.query<LogsSearchApiResponse, LogsSearchApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/logs`,
        params: {
          q: queryArg.q,
          level: queryArg.level,
          requestId: queryArg.requestId,
          from: queryArg['from'],
          to: queryArg.to,
          results: queryArg.results
        }
      })
    }),
    logsSlowTicks: build.query<LogsSlowTicksApiResponse, LogsSlowTicksApiArg>({
      query: () => ({ url: `/api/v1/admin/logs/slow-ticks` })
    }),
    securityOverview: build.query<SecurityOverviewApiResponse, SecurityOverviewApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/security`,
        params: {
          hours: queryArg.hours
        }
      })
    }),
    securityRevokeKey: build.mutation<SecurityRevokeKeyApiResponse, SecurityRevokeKeyApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/security/api-keys/${queryArg.id}/revoke`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    balanceOverview: build.query<BalanceOverviewApiResponse, BalanceOverviewApiArg>({
      query: () => ({ url: `/api/v1/admin/economy` })
    }),
    balanceState: build.query<BalanceStateApiResponse, BalanceStateApiArg>({
      query: () => ({ url: `/api/v1/admin/balance` })
    }),
    balanceSave: build.mutation<BalanceSaveApiResponse, BalanceSaveApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/balance`, method: 'POST', body: queryArg.saveBalanceDto })
    }),
    balanceVersion: build.query<BalanceVersionApiResponse, BalanceVersionApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/balance/versions/${queryArg.version}` })
    }),
    balancePreview: build.mutation<BalancePreviewApiResponse, BalancePreviewApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/balance/preview`, method: 'POST', body: queryArg.balanceDocumentDto })
    }),
    balanceRollback: build.mutation<BalanceRollbackApiResponse, BalanceRollbackApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/balance/versions/${queryArg.version}/rollback`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    operationsStatus: build.query<OperationsStatusApiResponse, OperationsStatusApiArg>({
      query: () => ({ url: `/api/v1/admin/operations` })
    }),
    operationsAnnounce: build.mutation<OperationsAnnounceApiResponse, OperationsAnnounceApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/operations/announcements`,
        method: 'POST',
        body: queryArg.announceDto
      })
    }),
    operationsSetBanner: build.mutation<OperationsSetBannerApiResponse, OperationsSetBannerApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/operations/maintenance-banner`,
        method: 'PUT',
        body: queryArg.maintenanceBannerDto
      })
    }),
    operationsClearBanner: build.mutation<OperationsClearBannerApiResponse, OperationsClearBannerApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/operations/maintenance-banner`,
        method: 'DELETE',
        body: queryArg.reasonDto
      })
    }),
    operationsRestartRuntime: build.mutation<OperationsRestartRuntimeApiResponse, OperationsRestartRuntimeApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/operations/restart-runtime`,
        method: 'POST',
        body: queryArg.reasonDto
      })
    }),
    maintenanceStatus: build.query<MaintenanceStatusApiResponse, MaintenanceStatusApiArg>({
      query: () => ({ url: `/api/v1/maintenance` })
    }),
    analyticsReport: build.query<AnalyticsReportApiResponse, AnalyticsReportApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/analytics`,
        params: {
          days: queryArg.days
        }
      })
    }),
    analyticsExport: build.query<AnalyticsExportApiResponse, AnalyticsExportApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/analytics/export`,
        params: {
          days: queryArg.days,
          report: queryArg.report
        }
      })
    }),
    devToolsStatus: build.query<DevToolsStatusApiResponse, DevToolsStatusApiArg>({
      query: () => ({ url: `/api/v1/admin/devtools` })
    }),
    devToolsSeedWorld: build.mutation<DevToolsSeedWorldApiResponse, DevToolsSeedWorldApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/devtools/seed-world`, method: 'POST', body: queryArg.seedWorldDto })
    }),
    devToolsRemoveTestPlayers: build.mutation<DevToolsRemoveTestPlayersApiResponse, DevToolsRemoveTestPlayersApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/devtools/test-players`, method: 'DELETE', body: queryArg.reasonDto })
    }),
    craftingRecipeList: build.query<CraftingRecipeListApiResponse, CraftingRecipeListApiArg>({
      query: () => ({ url: `/api/v1/crafting/recipes` })
    }),
    filesDrives: build.query<FilesDrivesApiResponse, FilesDrivesApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.botId}/drives` })
    }),
    filesList: build.query<FilesListApiResponse, FilesListApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/drives/${queryArg.driveId}/files`,
        params: {
          directory: queryArg.directory
        }
      })
    }),
    filesRead: build.query<FilesReadApiResponse, FilesReadApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/drives/${queryArg.driveId}/file`,
        params: {
          path: queryArg.path
        }
      })
    }),
    filesWrite: build.mutation<FilesWriteApiResponse, FilesWriteApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/drives/${queryArg.driveId}/file`,
        method: 'PUT',
        body: queryArg.writeFileDto
      })
    }),
    filesRemove: build.mutation<FilesRemoveApiResponse, FilesRemoveApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/drives/${queryArg.driveId}/file`,
        method: 'DELETE',
        params: {
          path: queryArg.path
        }
      })
    }),
    filesMakeDirectory: build.mutation<FilesMakeDirectoryApiResponse, FilesMakeDirectoryApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/drives/${queryArg.driveId}/directories`,
        method: 'POST',
        body: queryArg.makeDirectoryDto
      })
    }),
    botsDeployBase: build.mutation<BotsDeployBaseApiResponse, BotsDeployBaseApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/base`, method: 'POST', body: queryArg.deployBaseDto })
    }),
    botsList: build.query<BotsListApiResponse, BotsListApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots`,
        params: {
          type: queryArg['type']
        }
      })
    }),
    botsBaseBots: build.query<BotsBaseBotsApiResponse, BotsBaseBotsApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.id}/bots` })
    }),
    botsModules: build.query<BotsModulesApiResponse, BotsModulesApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.id}/modules` })
    }),
    botsScan: build.mutation<BotsScanApiResponse, BotsScanApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.id}/scan`, method: 'POST' })
    }),
    botControlGetStorage: build.query<BotControlGetStorageApiResponse, BotControlGetStorageApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.botId}/storage` })
    }),
    botControlPerform: build.mutation<BotControlPerformApiResponse, BotControlPerformApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/actions`,
        method: 'POST',
        body: queryArg.manualActionDto
      })
    }),
    factoryStatus: build.query<FactoryStatusApiResponse, FactoryStatusApiArg>({
      query: (queryArg) => ({ url: `/api/v1/bots/${queryArg.baseId}/factory` })
    }),
    factoryCraft: build.mutation<FactoryCraftApiResponse, FactoryCraftApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.baseId}/factory/craft`,
        method: 'POST',
        body: queryArg.craftDto
      })
    }),
    factoryResearch: build.mutation<FactoryResearchApiResponse, FactoryResearchApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.baseId}/factory/research`,
        method: 'POST',
        body: queryArg.researchDto
      })
    }),
    factoryLearn: build.mutation<FactoryLearnApiResponse, FactoryLearnApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.baseId}/factory/learn`,
        method: 'POST',
        body: queryArg.learnDto
      })
    }),
    factoryAssemble: build.mutation<FactoryAssembleApiResponse, FactoryAssembleApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.baseId}/factory/assemble`,
        method: 'POST',
        body: queryArg.assembleDto
      })
    }),
    maintenanceRepair: build.mutation<MaintenanceRepairApiResponse, MaintenanceRepairApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/maintenance/repair`,
        method: 'POST',
        body: queryArg.maintenanceDto
      })
    }),
    maintenanceDisassemble: build.mutation<MaintenanceDisassembleApiResponse, MaintenanceDisassembleApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/maintenance/disassemble`,
        method: 'POST',
        body: queryArg.maintenanceDto
      })
    }),
    mapGet: build.query<MapGetApiResponse, MapGetApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/map`,
        params: {
          minX: queryArg.minX,
          minY: queryArg.minY,
          maxX: queryArg.maxX,
          maxY: queryArg.maxY
        }
      })
    }),
    mapPosition: build.query<MapPositionApiResponse, MapPositionApiArg>({
      query: (queryArg) => ({ url: `/api/v1/map/bots/${queryArg.botId}` })
    }),
    settingsGet: build.query<SettingsGetApiResponse, SettingsGetApiArg>({
      query: () => ({ url: `/api/v1/settings` })
    }),
    settingsUpdate: build.mutation<SettingsUpdateApiResponse, SettingsUpdateApiArg>({
      query: (queryArg) => ({ url: `/api/v1/settings`, method: 'PATCH', body: queryArg.updateUserSettingsDto })
    }),
    adminSettingsGet: build.query<AdminSettingsGetApiResponse, AdminSettingsGetApiArg>({
      query: () => ({ url: `/api/v1/admin/settings` })
    }),
    adminSettingsUpdate: build.mutation<AdminSettingsUpdateApiResponse, AdminSettingsUpdateApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/settings`, method: 'PATCH', body: queryArg.updateGameSettingsDto })
    }),
    tutorialGet: build.query<TutorialGetApiResponse, TutorialGetApiArg>({
      query: () => ({ url: `/api/v1/tutorial` })
    }),
    tutorialSkip: build.mutation<TutorialSkipApiResponse, TutorialSkipApiArg>({
      query: () => ({ url: `/api/v1/tutorial/skip`, method: 'POST' })
    }),
    tutorialRestart: build.mutation<TutorialRestartApiResponse, TutorialRestartApiArg>({
      query: () => ({ url: `/api/v1/tutorial/restart`, method: 'POST' })
    }),
    achievementsList: build.query<AchievementsListApiResponse, AchievementsListApiArg>({
      query: () => ({ url: `/api/v1/achievements` })
    }),
    notificationsList: build.query<NotificationsListApiResponse, NotificationsListApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/notifications`,
        params: {
          limit: queryArg.limit,
          before: queryArg.before,
          unread: queryArg.unread
        }
      })
    }),
    notificationsSummary: build.query<NotificationsSummaryApiResponse, NotificationsSummaryApiArg>({
      query: () => ({ url: `/api/v1/notifications/summary` })
    }),
    notificationsMarkRead: build.mutation<NotificationsMarkReadApiResponse, NotificationsMarkReadApiArg>({
      query: (queryArg) => ({ url: `/api/v1/notifications/read`, method: 'POST', body: queryArg.markReadDto })
    }),
    notificationsPreferences: build.query<NotificationsPreferencesApiResponse, NotificationsPreferencesApiArg>({
      query: () => ({ url: `/api/v1/notifications/preferences` })
    }),
    notificationsUpdatePreferences: build.mutation<
      NotificationsUpdatePreferencesApiResponse,
      NotificationsUpdatePreferencesApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/notifications/preferences`,
        method: 'PATCH',
        body: queryArg.updateNotificationPreferencesDto
      })
    }),
    executionsList: build.query<ExecutionsListApiResponse, ExecutionsListApiArg>({
      query: () => ({ url: `/api/v1/executions` })
    }),
    executionsStart: build.mutation<ExecutionsStartApiResponse, ExecutionsStartApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/executions`,
        method: 'POST',
        body: queryArg.startExecutionDto
      })
    }),
    executionsKill: build.mutation<ExecutionsKillApiResponse, ExecutionsKillApiArg>({
      query: (queryArg) => ({ url: `/api/v1/executions/${queryArg.executionId}`, method: 'DELETE' })
    }),
    executionsHistory: build.query<ExecutionsHistoryApiResponse, ExecutionsHistoryApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/bots/${queryArg.botId}/terminal-history`,
        params: {
          limit: queryArg.limit
        }
      })
    }),
    healthReady: build.query<HealthReadyApiResponse, HealthReadyApiArg>({
      query: () => ({ url: `/api/v1/health` })
    }),
    healthLive: build.query<HealthLiveApiResponse, HealthLiveApiArg>({
      query: () => ({ url: `/api/v1/health/live` })
    }),
    monitoringHealth: build.query<MonitoringHealthApiResponse, MonitoringHealthApiArg>({
      query: () => ({ url: `/api/v1/admin/monitoring/health` })
    }),
    monitoringSeries: build.query<MonitoringSeriesApiResponse, MonitoringSeriesApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/admin/monitoring/series`,
        params: {
          metric: queryArg.metric,
          range: queryArg.range
        }
      })
    }),
    monitoringAlerts: build.query<MonitoringAlertsApiResponse, MonitoringAlertsApiArg>({
      query: () => ({ url: `/api/v1/admin/monitoring/alerts` })
    }),
    monitoringAcknowledge: build.mutation<MonitoringAcknowledgeApiResponse, MonitoringAcknowledgeApiArg>({
      query: (queryArg) => ({ url: `/api/v1/admin/monitoring/alerts/${queryArg.id}/acknowledge`, method: 'POST' })
    }),
    gameTimeCurrent: build.query<GameTimeCurrentApiResponse, GameTimeCurrentApiArg>({
      query: () => ({ url: `/api/v1/time` })
    }),
    apiKeysList: build.query<ApiKeysListApiResponse, ApiKeysListApiArg>({
      query: () => ({ url: `/api/v1/api-keys` })
    }),
    apiKeysCreate: build.mutation<ApiKeysCreateApiResponse, ApiKeysCreateApiArg>({
      query: (queryArg) => ({ url: `/api/v1/api-keys`, method: 'POST', body: queryArg.createApiKeyDto })
    }),
    apiKeysRevoke: build.mutation<ApiKeysRevokeApiResponse, ApiKeysRevokeApiArg>({
      query: (queryArg) => ({ url: `/api/v1/api-keys/${queryArg.id}`, method: 'DELETE' })
    })
  }),
  overrideExisting: false
})
export { injectedRtkApi as api }
export type UsersMeApiResponse = /** status 200  */ UserInfoResponse
export type UsersMeApiArg = void
export type UsersListApiResponse = /** status 200  */ UsersPageResponse
export type UsersListApiArg = {
  page?: number
  results?: number
  status?: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
  /** The email is verified */
  active?: boolean
  email?: string
}
export type UsersUpdateApiResponse = /** status 200  */ UserUpdatedResponse
export type UsersUpdateApiArg = {
  id: string
  updateUserDto: UpdateUserDto
}
export type AuthRegisterApiResponse = /** status 201  */ AuthTokenResponse
export type AuthRegisterApiArg = {
  registerDto: RegisterDto
}
export type AuthLoginApiResponse = /** status 200  */ AuthTokenResponse
export type AuthLoginApiArg = {
  loginDto: LoginDto
}
export type AuthRefreshApiResponse = /** status 200  */ AuthTokenResponse
export type AuthRefreshApiArg = void
export type AuthLogoutApiResponse = unknown
export type AuthLogoutApiArg = void
export type AuthVerifyEmailApiResponse = unknown
export type AuthVerifyEmailApiArg = {
  tokenDto: TokenDto
}
export type AuthResendVerificationApiResponse = unknown
export type AuthResendVerificationApiArg = {
  emailDto: EmailDto
}
export type AuthForgotPasswordApiResponse = unknown
export type AuthForgotPasswordApiArg = {
  emailDto: EmailDto
}
export type AuthResetPasswordApiResponse = unknown
export type AuthResetPasswordApiArg = {
  resetPasswordDto: ResetPasswordDto
}
export type AuthChangePasswordApiResponse = unknown
export type AuthChangePasswordApiArg = {
  changePasswordDto: ChangePasswordDto
}
export type AuthRequestEmailChangeApiResponse = unknown
export type AuthRequestEmailChangeApiArg = {
  changeEmailDto: ChangeEmailDto
}
export type AuthConfirmEmailChangeApiResponse = unknown
export type AuthConfirmEmailChangeApiArg = {
  tokenDto: TokenDto
}
export type AuthRequestAccountDeletionApiResponse = unknown
export type AuthRequestAccountDeletionApiArg = {
  passwordDto: PasswordDto
}
export type AuthConfirmAccountDeletionApiResponse = unknown
export type AuthConfirmAccountDeletionApiArg = {
  tokenDto: TokenDto
}
export type AdminMeApiResponse = /** status 200  */ AdminMeResponse
export type AdminMeApiArg = void
export type AdminEnrollApiResponse = /** status 201  */ TwoFactorEnrollmentResponse
export type AdminEnrollApiArg = void
export type AdminConfirmApiResponse = /** status 200  */ TwoFactorRecoveryCodesResponse
export type AdminConfirmApiArg = {
  twoFactorCodeDto: TwoFactorCodeDto
}
export type AdminVerifyApiResponse = unknown
export type AdminVerifyApiArg = {
  twoFactorCodeDto: TwoFactorCodeDto
}
export type AuditListApiResponse = /** status 200  */ AuditPageResponse
export type AuditListApiArg = {
  page?: number
  results?: number
  actorId?: string
  action?: string
  targetId?: string
  outcome?: 'success' | 'denied' | 'failed'
  from?: string
  to?: string
}
export type AuditExportApiResponse = /** status 200 CSV */ string
export type AuditExportApiArg = {
  page?: number
  results?: number
  actorId?: string
  action?: string
  targetId?: string
  outcome?: 'success' | 'denied' | 'failed'
  from?: string
  to?: string
}
export type PlayersSearchApiResponse = /** status 200  */ PlayersPageResponse
export type PlayersSearchApiArg = {
  page?: number
  results?: number
  /** Part of the name or email, or the exact id */
  q?: string
  status?: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
  isEmailVerified?: boolean
  registeredFrom?: string
  registeredTo?: string
  sort?: 'createdAt' | 'name' | 'email'
  order?: 'asc' | 'desc'
}
export type PlayersProfileApiResponse = /** status 200  */ PlayerProfileResponse
export type PlayersProfileApiArg = {
  id: string
}
export type PlayersRemoveApiResponse = unknown
export type PlayersRemoveApiArg = {
  id: string
  deletePlayerDto: DeletePlayerDto
}
export type PlayersBanApiResponse = unknown
export type PlayersBanApiArg = {
  id: string
  banPlayerDto: BanPlayerDto
}
export type PlayersUnbanApiResponse = unknown
export type PlayersUnbanApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type PlayersLogoutApiResponse = unknown
export type PlayersLogoutApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type PlayersResendVerificationApiResponse = unknown
export type PlayersResendVerificationApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type PlayersResetPasswordApiResponse = unknown
export type PlayersResetPasswordApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type PlayersChangeRoleApiResponse = unknown
export type PlayersChangeRoleApiArg = {
  id: string
  changeRoleDto: ChangeRoleDto
}
export type PlayersAddNoteApiResponse = /** status 201  */ PlayerNoteResponse
export type PlayersAddNoteApiArg = {
  id: string
  addNoteDto: AddNoteDto
}
export type ViewAsStartApiResponse = /** status 201  */ ViewAsStartResponse
export type ViewAsStartApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type ViewAsExitApiResponse = unknown
export type ViewAsExitApiArg = void
export type InspectorSearchApiResponse = /** status 200  */ SearchResultResponse[]
export type InspectorSearchApiArg = {
  /** The id of a bot, a base or a player, or a cell like 12,-4 */
  q: string
}
export type InspectorBotApiResponse = /** status 200  */ InspectorBotResponse
export type InspectorBotApiArg = {
  id: string
}
export type InspectorFilesApiResponse = /** status 200  */ InspectorFileResponse[]
export type InspectorFilesApiArg = {
  id: string
  driveId: string
  /** A directory of the drive; omitted: the root */
  dir?: string
}
export type InspectorFileApiResponse = /** status 200  */ InspectorFileContentResponse
export type InspectorFileApiArg = {
  id: string
  driveId: string
  path: string
}
export type InspectorMapApiResponse = /** status 200  */ MapViewResponse
export type InspectorMapApiArg = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export type InspectorHeatmapApiResponse = /** status 200  */ HeatmapResponse
export type InspectorHeatmapApiArg = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  kind: 'density' | 'depletion' | 'activity'
  /** Cells per side of a bucket */
  bucket: 8 | 16 | 32 | 64
}
export type SupervisionStateApiResponse = /** status 200  */ SupervisionStateResponse
export type SupervisionStateApiArg = void
export type SupervisionKillApiResponse = unknown
export type SupervisionKillApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type SupervisionRebootApiResponse = unknown
export type SupervisionRebootApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type SupervisionQuarantineApiResponse = unknown
export type SupervisionQuarantineApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type SupervisionReleaseApiResponse = unknown
export type SupervisionReleaseApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type SupervisionPauseApiResponse = unknown
export type SupervisionPauseApiArg = {
  pauseWorldDto: PauseWorldDto
}
export type SupervisionResumeApiResponse = unknown
export type SupervisionResumeApiArg = {
  reasonDto: ReasonDto
}
export type SupervisionHaltApiResponse = unknown
export type SupervisionHaltApiArg = {
  haltScriptsDto: HaltScriptsDto
}
export type SupervisionAllowApiResponse = unknown
export type SupervisionAllowApiArg = {
  reasonDto: ReasonDto
}
export type SupervisionGrantApiResponse = unknown
export type SupervisionGrantApiArg = {
  supportResourcesDto: SupportResourcesDto
}
export type SupervisionCompensateApiResponse = unknown
export type SupervisionCompensateApiArg = {
  supportResourcesDto: SupportResourcesDto
}
export type SupervisionRemoveApiResponse = unknown
export type SupervisionRemoveApiArg = {
  supportResourcesDto: SupportResourcesDto
}
export type SupervisionRestoreApiResponse = unknown
export type SupervisionRestoreApiArg = {
  restoreModuleDto: RestoreModuleDto
}
export type LogsSearchApiResponse = /** status 200  */ LogPageResponse
export type LogsSearchApiArg = {
  /** A part of the line, such as the id of a player or a bot */
  q?: string
  level?: 'info' | 'warn' | 'error'
  /** The id of a request (the X-Request-Id of its response) */
  requestId?: string
  from?: string
  to?: string
  results?: number
}
export type LogsSlowTicksApiResponse = /** status 200  */ SlowTickResponse[]
export type LogsSlowTicksApiArg = void
export type SecurityOverviewApiResponse = /** status 200  */ SecurityOverviewResponse
export type SecurityOverviewApiArg = {
  /** How far back to look, in hours */
  hours: 1 | 6 | 24 | 72 | 168
}
export type SecurityRevokeKeyApiResponse = unknown
export type SecurityRevokeKeyApiArg = {
  id: string
  reasonDto: ReasonDto
}
export type BalanceOverviewApiResponse = /** status 200  */ EconomyOverviewResponse
export type BalanceOverviewApiArg = void
export type BalanceStateApiResponse = /** status 200  */ BalanceStateResponse
export type BalanceStateApiArg = void
export type BalanceSaveApiResponse = unknown
export type BalanceSaveApiArg = {
  saveBalanceDto: SaveBalanceDto
}
export type BalanceVersionApiResponse = /** status 200  */ BalanceVersionDocumentResponse
export type BalanceVersionApiArg = {
  version: number
}
export type BalancePreviewApiResponse = /** status 200  */ BalancePreviewResponse
export type BalancePreviewApiArg = {
  balanceDocumentDto: BalanceDocumentDto
}
export type BalanceRollbackApiResponse = unknown
export type BalanceRollbackApiArg = {
  version: number
  reasonDto: ReasonDto
}
export type OperationsStatusApiResponse = /** status 200  */ OperationsStatusResponse
export type OperationsStatusApiArg = void
export type OperationsAnnounceApiResponse = /** status 200  */ AnnouncementResultResponse
export type OperationsAnnounceApiArg = {
  announceDto: AnnounceDto
}
export type OperationsSetBannerApiResponse = unknown
export type OperationsSetBannerApiArg = {
  maintenanceBannerDto: MaintenanceBannerDto
}
export type OperationsClearBannerApiResponse = unknown
export type OperationsClearBannerApiArg = {
  reasonDto: ReasonDto
}
export type OperationsRestartRuntimeApiResponse = /** status 200  */ RestartResultResponse
export type OperationsRestartRuntimeApiArg = {
  reasonDto: ReasonDto
}
export type MaintenanceStatusApiResponse = /** status 200  */ MaintenanceStatusResponse
export type MaintenanceStatusApiArg = void
export type AnalyticsReportApiResponse = /** status 200  */ AnalyticsResponse
export type AnalyticsReportApiArg = {
  /** The window, in days */
  days?: 7 | 30 | 90
}
export type AnalyticsExportApiResponse = /** status 200 CSV */ string
export type AnalyticsExportApiArg = {
  /** The window, in days */
  days?: 7 | 30 | 90
  report: 'activity' | 'retention' | 'funnel' | 'achievements'
}
export type DevToolsStatusApiResponse = /** status 200  */ DevToolsStatusResponse
export type DevToolsStatusApiArg = void
export type DevToolsSeedWorldApiResponse = /** status 200  */ SeedWorldResponse
export type DevToolsSeedWorldApiArg = {
  seedWorldDto: SeedWorldDto
}
export type DevToolsRemoveTestPlayersApiResponse = /** status 200  */ RemoveTestPlayersResponse
export type DevToolsRemoveTestPlayersApiArg = {
  reasonDto: ReasonDto
}
export type CraftingRecipeListApiResponse = /** status 200  */ RecipeResponse[]
export type CraftingRecipeListApiArg = void
export type FilesDrivesApiResponse = /** status 200  */ DriveResponse[]
export type FilesDrivesApiArg = {
  botId: string
}
export type FilesListApiResponse = /** status 200  */ FileResponse[]
export type FilesListApiArg = {
  botId: string
  driveId: string
  directory?: string
}
export type FilesReadApiResponse = /** status 200  */ FileResponse
export type FilesReadApiArg = {
  botId: string
  driveId: string
  path: string
}
export type FilesWriteApiResponse = /** status 200  */ FileResponse
export type FilesWriteApiArg = {
  botId: string
  driveId: string
  writeFileDto: WriteFileDto
}
export type FilesRemoveApiResponse = unknown
export type FilesRemoveApiArg = {
  botId: string
  driveId: string
  path: string
}
export type FilesMakeDirectoryApiResponse = /** status 201  */ FileResponse
export type FilesMakeDirectoryApiArg = {
  botId: string
  driveId: string
  makeDirectoryDto: MakeDirectoryDto
}
export type BotsDeployBaseApiResponse = /** status 201  */ DeployedBaseResponse
export type BotsDeployBaseApiArg = {
  deployBaseDto: DeployBaseDto
}
export type BotsListApiResponse = /** status 200  */ BotResponse[]
export type BotsListApiArg = {
  type?: 'base' | 'worker'
}
export type BotsBaseBotsApiResponse = /** status 200  */ BotResponse[]
export type BotsBaseBotsApiArg = {
  id: string
}
export type BotsModulesApiResponse = /** status 200  */ ModuleResponse[]
export type BotsModulesApiArg = {
  id: string
}
export type BotsScanApiResponse = /** status 200  */ MapPointResponse[]
export type BotsScanApiArg = {
  id: string
}
export type BotControlGetStorageApiResponse = /** status 200  */ BotStorageResponse
export type BotControlGetStorageApiArg = {
  botId: string
}
export type BotControlPerformApiResponse = /** status 200  */ ManualActionResponse
export type BotControlPerformApiArg = {
  botId: string
  manualActionDto: ManualActionDto
}
export type FactoryStatusApiResponse = /** status 200  */ FactoryStatusResponse
export type FactoryStatusApiArg = {
  baseId: string
}
export type FactoryCraftApiResponse = /** status 201  */ FactoryJobResponse[]
export type FactoryCraftApiArg = {
  baseId: string
  craftDto: CraftDto
}
export type FactoryResearchApiResponse = /** status 201  */ FactoryJobResponse
export type FactoryResearchApiArg = {
  baseId: string
  researchDto: ResearchDto
}
export type FactoryLearnApiResponse = /** status 201  */ BlueprintResponse
export type FactoryLearnApiArg = {
  baseId: string
  learnDto: LearnDto
}
export type FactoryAssembleApiResponse = /** status 201  */ AssembledBotResponse
export type FactoryAssembleApiArg = {
  baseId: string
  assembleDto: AssembleDto
}
export type MaintenanceRepairApiResponse = /** status 200 The module after the repair */ ModuleResponse
export type MaintenanceRepairApiArg = {
  botId: string
  maintenanceDto: MaintenanceDto
}
export type MaintenanceDisassembleApiResponse = /** status 200  */ DisassemblyResponse
export type MaintenanceDisassembleApiArg = {
  botId: string
  maintenanceDto: MaintenanceDto
}
export type MapGetApiResponse = /** status 200  */ MapViewResponse
export type MapGetApiArg = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export type MapPositionApiResponse = /** status 200  */ BotPositionResponse
export type MapPositionApiArg = {
  botId: string
}
export type SettingsGetApiResponse = /** status 200  */ SettingsResponse
export type SettingsGetApiArg = void
export type SettingsUpdateApiResponse = /** status 200  */ SettingsResponse
export type SettingsUpdateApiArg = {
  updateUserSettingsDto: UpdateUserSettingsDto
}
export type AdminSettingsGetApiResponse = /** status 200  */ GameSettingsResponse
export type AdminSettingsGetApiArg = void
export type AdminSettingsUpdateApiResponse = /** status 200  */ GameSettingsResponse
export type AdminSettingsUpdateApiArg = {
  updateGameSettingsDto: UpdateGameSettingsDto
}
export type TutorialGetApiResponse = /** status 200  */ TutorialResponse
export type TutorialGetApiArg = void
export type TutorialSkipApiResponse = /** status 200  */ TutorialResponse
export type TutorialSkipApiArg = void
export type TutorialRestartApiResponse = /** status 200  */ TutorialResponse
export type TutorialRestartApiArg = void
export type AchievementsListApiResponse = /** status 200  */ AchievementResponse[]
export type AchievementsListApiArg = void
export type NotificationsListApiResponse = /** status 200  */ NotificationListResponse
export type NotificationsListApiArg = {
  limit?: number
  /** Only notifications older than this time (ms since the epoch), for the next page */
  before?: number
  /** Only those not read yet */
  unread?: boolean
}
export type NotificationsSummaryApiResponse = /** status 200  */ NotificationSummaryResponse
export type NotificationsSummaryApiArg = void
export type NotificationsMarkReadApiResponse = /** status 200  */ MarkedReadResponse
export type NotificationsMarkReadApiArg = {
  markReadDto: MarkReadDto
}
export type NotificationsPreferencesApiResponse = /** status 200  */ NotificationPreferencesResponse
export type NotificationsPreferencesApiArg = void
export type NotificationsUpdatePreferencesApiResponse = /** status 200  */ NotificationPreferencesResponse
export type NotificationsUpdatePreferencesApiArg = {
  updateNotificationPreferencesDto: UpdateNotificationPreferencesDto
}
export type ExecutionsListApiResponse =
  /** status 200 The scripts of the player that are still running */ ExecutionResponse[]
export type ExecutionsListApiArg = void
export type ExecutionsStartApiResponse = /** status 200  */ ExecutionResponse
export type ExecutionsStartApiArg = {
  botId: string
  startExecutionDto: StartExecutionDto
}
export type ExecutionsKillApiResponse = /** status 200  */ ExecutionResponse
export type ExecutionsKillApiArg = {
  executionId: string
}
export type ExecutionsHistoryApiResponse = /** status 200  */ TerminalLogEntryResponse[]
export type ExecutionsHistoryApiArg = {
  botId: string
  /** How many of the newest lines */
  limit?: number
}
export type HealthReadyApiResponse = /** status 200  */ HealthResponse
export type HealthReadyApiArg = void
export type HealthLiveApiResponse = /** status 200  */ HealthResponse
export type HealthLiveApiArg = void
export type MonitoringHealthApiResponse = /** status 200  */ HealthReportResponse
export type MonitoringHealthApiArg = void
export type MonitoringSeriesApiResponse = /** status 200  */ MetricSeriesResponse
export type MonitoringSeriesApiArg = {
  metric: string
  range: '1h' | '6h' | '24h' | '7d' | '30d'
}
export type MonitoringAlertsApiResponse = /** status 200  */ AlertResponse[]
export type MonitoringAlertsApiArg = void
export type MonitoringAcknowledgeApiResponse = /** status 200  */ AlertResponse
export type MonitoringAcknowledgeApiArg = {
  id: string
}
export type GameTimeCurrentApiResponse = /** status 200  */ GameTimeResponse
export type GameTimeCurrentApiArg = void
export type ApiKeysListApiResponse = /** status 200  */ ApiKeyResponse[]
export type ApiKeysListApiArg = void
export type ApiKeysCreateApiResponse = /** status 201  */ CreatedApiKeyResponse
export type ApiKeysCreateApiArg = {
  createApiKeyDto: CreateApiKeyDto
}
export type ApiKeysRevokeApiResponse = /** status 200  */ ApiKeyResponse
export type ApiKeysRevokeApiArg = {
  id: string
}
export type UserInfoResponse = {
  _id: string
  name: string
  email: string
  status: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
  /** The email is verified */
  active: boolean
  subscription: 'free' | 'monthly' | 'yearly'
  /** Milliseconds since the epoch */
  createdAt: number
  /** Milliseconds since the epoch */
  updatedAt?: number
}
export type ErrorResponseModel = {
  statusCode: number
  /** Stable machine-readable code; clients branch on it */
  code:
    | 'UNAUTHORIZED'
    | 'VALIDATION_FAILED'
    | 'CREDENTIALS_INVALID'
    | 'EMAIL_ALREADY_EXISTS'
    | 'EMAIL_NOT_VERIFIED'
    | 'PRIVACY_NOT_ACCEPTED'
    | 'USER_BANNED'
    | 'INVALID_TOKEN'
    | 'TOKEN_EXPIRED'
    | 'WRONG_PASSWORD'
    | 'SERVICE_UNAVAILABLE'
    | 'SPAWN_SEED_CLOSED'
    | 'SPAWN_SEED_FULL'
    | 'BASE_LOST'
    | 'BASE_ALREADY_EXISTS'
    | 'NO_FREE_LOCATION'
    | 'UNKNOWN_COMMAND'
    | 'SCRIPT_LOAD_FAILED'
    | 'BOT_PASSWORD_WRONG'
    | 'BOT_LOCKED'
    | 'CANNOT_ADOPT_BASE'
    | 'COMMAND_USAGE'
    | 'NO_DRIVE_SELECTED'
    | 'DRIVE_FULL'
    | 'DRIVE_BROKEN'
    | 'ALREADY_EXISTS'
    | 'TERMINAL_SESSION_CLOSED'
    | 'TOO_MANY_REQUESTS'
    | 'PAYLOAD_TOO_LARGE'
    | 'TOO_MANY_API_KEYS'
    | 'API_KEY_SCOPE'
    | 'SESSION_ONLY'
    | 'TWO_FACTOR_REQUIRED'
    | 'TWO_FACTOR_INVALID'
    | 'ADMIN_IP_NOT_ALLOWED'
    | 'MAINTENANCE_MODE'
    | 'SCRIPTS_HALTED'
    | 'PLAYER_QUARANTINED'
    | 'REQUEST_TIMEOUT'
    | 'MANUAL_CATEGORY_DISABLED'
    | 'VIEW_AS_READ_ONLY'
    | 'INTERNAL_ERROR'
    | 'BLOCKED'
    | 'EMPTY'
    | 'GONE'
    | 'NO_ENERGY'
    | 'NO_MODULE'
    | 'NO_BLUEPRINT'
    | 'BROKEN_MODULE'
    | 'NO_FUNDS'
    | 'NOT_LIVE'
    | 'BUSY'
    | 'NOT_FOUND'
    | 'TOO_LOW'
    | 'TOO_HEAVY'
    | 'EXPIRED'
    | 'INBOX_FULL'
    | 'OUT_OF_RANGE'
    | 'COOLDOWN'
    | 'NO_AMMO'
    | 'NO_SIGNAL'
    | 'NO_SPACE'
    | 'FORBIDDEN'
  /** The human-readable message */
  error: string
}
export type PaginationModel = {
  page: number
  results: number
  total: number
}
export type UsersMetaModel = {
  pagination: PaginationModel
}
export type UsersPageResponse = {
  result: UserInfoResponse[]
  meta: UsersMetaModel
}
export type UserUpdatedResponse = {
  result: UserInfoResponse
}
export type UpdateUserDto = {
  name?: string
  subscription?: 'free' | 'monthly' | 'yearly'
  /** Only an owner may change the status */
  status?: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
}
export type AuthTokenResponse = {
  /** The access token; the refresh token travels in an HTTP-only cookie */
  accessToken: string
}
export type RegisterDto = {
  /** First and last name */
  name: string
  email: string
  password: string
  /** The version of the privacy policy the player accepted */
  acceptedPrivacyVersion: string
}
export type LoginDto = {
  email: string
  password: string
}
export type TokenDto = {
  token: string
}
export type EmailDto = {
  email: string
}
export type ResetPasswordDto = {
  token: string
  password: string
}
export type ChangePasswordDto = {
  currentPassword: string
  newPassword: string
}
export type ChangeEmailDto = {
  password: string
  newEmail: string
}
export type PasswordDto = {
  password: string
}
export type TwoFactorStateModel = {
  isEnrolled: boolean
  isVerified: boolean
}
export type AdminMeResponse = {
  role: 'owner' | 'admin' | 'moderator' | 'analyst'
  permissions: (
    | 'dashboard.read'
    | 'alerts.acknowledge'
    | 'players.read'
    | 'players.ban'
    | 'players.logout'
    | 'players.resend-verification'
    | 'players.reset-password'
    | 'players.notes'
    | 'players.change-role'
    | 'players.delete'
    | 'players.view-as'
    | 'inspector.read'
    | 'inspector.files.read'
    | 'inspector.kill-execution'
    | 'inspector.reboot-bot'
    | 'map.read'
    | 'supervision.read'
    | 'supervision.quarantine'
    | 'supervision.support'
    | 'ops.pause-world'
    | 'ops.kill-switch'
    | 'ops.announce'
    | 'ops.restart-runtime'
    | 'security.read'
    | 'security.revoke-key'
    | 'economy.read'
    | 'balance.write'
    | 'logs.read'
    | 'audit.read'
    | 'audit.export'
    | 'analytics.read'
    | 'devtools.use'
  )[]
  twoFactor: TwoFactorStateModel
}
export type TwoFactorEnrollmentResponse = {
  secret: string
  otpauthUrl: string
}
export type TwoFactorRecoveryCodesResponse = {
  recoveryCodes: string[]
}
export type TwoFactorCodeDto = {
  /** A six-digit authenticator code or a recovery code */
  code: string
}
export type AuditEntryResponse = {
  _id: string
  /** Milliseconds since the epoch */
  at: number
  actorId: string
  actorRole: string
  action: string
  outcome: 'success' | 'denied' | 'failed'
  targetType: string | null
  targetId: string | null
  reason: string | null
  before: object | null
  after: object | null
  ip: string | null
  requestId: string | null
}
export type AuditPaginationModel = {
  page: number
  results: number
  total: number
}
export type AuditMetaModel = {
  pagination: AuditPaginationModel
}
export type AuditPageResponse = {
  result: AuditEntryResponse[]
  meta: AuditMetaModel
}
export type PlayerListItemResponse = {
  _id: string
  name: string
  email: string
  status: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
  isEmailVerified: boolean
  /** Milliseconds since the epoch */
  createdAt: number
  lastLoginAt: number | null
}
export type PlayersMetaModel = {
  pagination: PaginationModel
}
export type PlayersPageResponse = {
  result: PlayerListItemResponse[]
  meta: PlayersMetaModel
}
export type PlayerSessionModel = {
  _id: string
  userAgent: string | null
  createdAt: number
  lastUsedAt: number
  expiresAt: number
  isActive: boolean
}
export type PlayerBaseModel = {
  _id: string
  label: string | null
  botCount: number
}
export type PlayerResourceModel = {
  resource: string
  amount: number
}
export type PlayerBanResponse = {
  _id: string
  reason: string
  bannedBy: string
  createdAt: number
  expiresAt: number | null
  liftedAt: number | null
  liftedBy: string | null
}
export type PlayerNoteResponse = {
  _id: string
  authorId: string
  text: string
  createdAt: number
}
export type TimelineEntryModel = {
  at: number
  kind: 'registered' | 'login' | 'ban' | 'unban' | 'admin-action'
  detail: string | null
}
export type PlayerProfileResponse = {
  _id: string
  name: string
  email: string
  status: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
  isEmailVerified: boolean
  /** Milliseconds since the epoch */
  createdAt: number
  lastLoginAt: number | null
  isDeleted: boolean
  sessions: PlayerSessionModel[]
  bases: PlayerBaseModel[]
  botCount: number
  resources: PlayerResourceModel[]
  runningExecutions: number
  activeBan: PlayerBanResponse | null
  bans: PlayerBanResponse[]
  notes: PlayerNoteResponse[]
  timeline: TimelineEntryModel[]
}
export type DeletePlayerDto = {
  reason: string
  /** The player's current email, typed to confirm */
  confirmEmail: string
}
export type BanPlayerDto = {
  reason: string
  /** Omitted: until an admin lifts the ban */
  durationHours?: number
}
export type ReasonDto = {
  reason: string
}
export type ChangeRoleDto = {
  reason: string
  role: 'admin' | 'owner' | 'moderator' | 'analyst' | 'user' | 'unlimited' | 'banned'
}
export type AddNoteDto = {
  text: string
}
export type ViewAsPlayerModel = {
  _id: string
  name: string
}
export type ViewAsStartResponse = {
  /** A token for the game screens of the player; it is read-only and ends at `expiresAt` */
  accessToken: string
  /** Milliseconds since the epoch */
  expiresAt: number
  player: ViewAsPlayerModel
}
export type SearchResultResponse = {
  kind: 'bot' | 'base' | 'player' | 'cell'
  id: string | null
  label: string
  x: number | null
  y: number | null
}
export type PositionModel = {
  x: number
  y: number
}
export type EnergyModel = {
  stored: number
  capacity: number
}
export type StockModel = {
  resource: string
  amount: number
}
export type InspectorModuleModel = {
  _id: string
  type: string
  name: string
  condition: number
  maxCondition: number
  weight: number
  props: {
    [key: string]: string
  }
}
export type InspectorDriveModel = {
  _id: string
  name: string
  quota: number
  usedBytes: number
}
export type InspectorExecutionModel = {
  _id: string
  file: string
  status: 'active' | 'finished' | 'killed'
  restarts: number
  reason: string | null
  createdAt: number
  endedAt: number | null
}
export type InspectorLogModel = {
  at: number
  kind: string
  text: string
}
export type InspectorBotResponse = {
  _id: string
  label: string | null
  type: 'base' | 'worker'
  ownerId: string | null
  ownerName: string | null
  baseId: string | null
  position: PositionModel | null
  heading: number
  energy: EnergyModel
  storage: StockModel[]
  modules: InspectorModuleModel[]
  drives: InspectorDriveModel[]
  executions: InspectorExecutionModel[]
  logs: InspectorLogModel[]
}
export type InspectorFileResponse = {
  path: string
  kind: 'file' | 'directory'
  size: number
}
export type InspectorFileContentResponse = {
  path: string
  size: number
  content: string
}
export type ResourceModel = {
  resource: 'iron' | 'stone' | 'wood' | 'oil' | 'crystal' | 'gold'
  amount: number
}
export type MapCellResponse = {
  x: number
  y: number
  type: ('resource' | 'bot' | 'item' | 'base' | 'corpse_base') | null
  contentId: string | null
  /** Game time of the snapshot, in ms */
  seenAt: number
  resource?: ResourceModel
  /** What the deposit held when it was generated */
  capacity?: number
  /** On bots and bases: whether they are the requesting player’s */
  isOwn?: boolean
  chassis?: 'wheels' | 'tracks' | 'immobile'
  icons?: ('weapon' | 'drill' | 'scanner' | 'antenna' | 'solar')[]
  isDamaged?: boolean
  item?: 'blueprint' | 'ammunition' | 'part' | 'generic'
}
export type LiveAreaResponse = {
  scannerId: string
  botId: string
  x: number
  y: number
  radius: number
}
export type MapViewResponse = {
  /** Game time of the server, in ms */
  now: number
  cells: MapCellResponse[]
  liveAreas: LiveAreaResponse[]
}
export type HeatBucketModel = {
  x: number
  y: number
  intensity: number
  value: number
}
export type HeatmapResponse = {
  kind: 'density' | 'depletion' | 'activity'
  bucket: number
  buckets: HeatBucketModel[]
}
export type QuarantinedPlayerModel = {
  _id: string
  name: string
}
export type SupervisionStateResponse = {
  isPaused: boolean
  areScriptsHalted: boolean
  quarantined: QuarantinedPlayerModel[]
  activeExecutions: number
  heldExecutions: number
}
export type PauseWorldDto = {
  reason: string
  /** Typed to confirm */
  confirm: 'PAUSE'
}
export type HaltScriptsDto = {
  reason: string
  /** Typed to confirm */
  confirm: 'HALT'
}
export type ResourceStackDto = {
  resource: 'iron' | 'stone' | 'wood' | 'oil' | 'crystal' | 'gold'
  amount: number
}
export type SupportResourcesDto = {
  reason: string
  /** The bot or base whose storage changes */
  botId: string
  stacks: ResourceStackDto[]
}
export type RestoreModuleDto = {
  reason: string
  botId: string
  moduleId: string
}
export type LogLineModel = {
  /** Milliseconds since the epoch */
  at: number
  level: 'info' | 'warn' | 'error'
  message: string
  requestId: string | null
}
export type LogPageResponse = {
  lines: LogLineModel[]
  total: number
  capacity: number
}
export type SlowTickResponse = {
  tick: number
  durationMs: number
  intervalMs: number
  isCut: boolean
  queuedExecutions: number
  deferredExecutions: number
}
export type FailedLoginModel = {
  key: string
  failures: number
  distinctEmails: number
  lastAt: number
}
export type PlayerRefModel = {
  _id: string
  name: string
}
export type SameIpModel = {
  ip: string
  accounts: PlayerRefModel[]
}
export type MultiIpModel = {
  _id: string
  name: string
  ips: number
}
export type BotLockoutModel = {
  botId: string
  label: string | null
  ownerId: string | null
  ownerName: string | null
  failures: number
  lockedUntil: number
}
export type SecurityKeyModel = {
  _id: string
  name: string
  prefix: string
  owner: PlayerRefModel
  scopes: string[]
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
  isRevoked: boolean
  rateLimitHits: number
}
export type SuspiciousScriptModel = {
  executionId: string
  owner: PlayerRefModel
  botId: string
  file: string
  code: string
  reason: string
  endedAt: number
}
export type ConsumerModel = {
  executionId: string
  userId: string
  botId: string
  file: string
  opsUsed: number
  ticks: number
}
export type SecurityOverviewResponse = {
  hours: number
  failedLoginsByIp: FailedLoginModel[]
  failedLoginsByEmail: FailedLoginModel[]
  sameIpAccounts: SameIpModel[]
  multiIpAccounts: MultiIpModel[]
  botLockouts: BotLockoutModel[]
  apiKeys: SecurityKeyModel[]
  suspiciousScripts: SuspiciousScriptModel[]
  topConsumers: ConsumerModel[] | null
}
export type EconomyStatModel = {
  resource: string
  deposits: number
  remaining: number
  capacity: number
  stored: number
}
export type BlueprintStatModel = {
  module: string
  research: number
  item: number
}
export type ModuleStatModel = {
  type: string
  name: string
  count: number
}
export type EconomyOverviewResponse = {
  resources: EconomyStatModel[]
  blueprints: BlueprintStatModel[]
  modules: ModuleStatModel[]
}
export type BalanceValueModel = {
  path: string
  value: string
}
export type BalanceVersionModel = {
  version: number
  reason: string
  createdBy: string
  createdAt: number
  isActive: boolean
}
export type BalanceStateResponse = {
  activeVersion: number | null
  runningVersion: number | null
  /** Why the stored version could not be used, when it could not */
  problem: string | null
  documentJson: string
  effective: BalanceValueModel[]
  versions: BalanceVersionModel[]
}
export type SaveBalanceDto = {
  reason: string
  /** Only what differs from the defaults: resources, recipes, crafting */
  document: {
    [key: string]: object
  }
}
export type BalanceVersionDocumentResponse = {
  documentJson: string
}
export type BalanceChangeModel = {
  path: string
  from: string | null
  to: string | null
}
export type BalancePreviewResponse = {
  problems: string[]
  changes: BalanceChangeModel[]
}
export type BalanceDocumentDto = {
  /** Only what differs from the defaults: resources, recipes, crafting */
  document: {
    [key: string]: object
  }
}
export type EngineStatusModel = {
  isResponding: boolean
  uptimeMs: number
  tick: number
  lastTickMs: number
  p95TickMs: number
  executions: number
  memoryBytes: number
}
export type JobStatusModel = {
  name: string
  lastRunAt: number | null
  failures: number
  totals: {
    [key: string]: number
  }
}
export type BackupStatusModel = {
  isConfigured: boolean
  finishedAt: number | null
  sizeBytes: number | null
  location: string | null
}
export type MaintenanceBannerModel = {
  message: string
  startsAt: number
  endsAt: number | null
}
export type OperationsStatusResponse = {
  engine: EngineStatusModel
  isPaused: boolean
  areScriptsHalted: boolean
  jobs: JobStatusModel[]
  backup: BackupStatusModel
  banner: MaintenanceBannerModel | null
}
export type AnnouncementResultResponse = {
  recipients: number
}
export type AnnounceDto = {
  reason: string
  /** What every player is told */
  text: string
}
export type MaintenanceBannerDto = {
  reason: string
  message: string
  /** When maintenance starts (ms since the epoch) */
  startsAt: number
  /** When it should end, if known */
  endsAt?: number | null
}
export type RestartResultResponse = {
  restarted: number
  failedBots: number
}
export type MaintenanceStatusResponse = {
  isPaused: boolean
  banner: MaintenanceBannerModel | null
}
export type ActivityDayModel = {
  /** UTC day, like 2026-10-15 */
  day: string
  users: number
}
export type ActivityStatsModel = {
  daily: ActivityDayModel[]
  dau: number
  mau: number
}
export type RetentionCohortModel = {
  /** The Monday of the week of sign-up */
  cohort: string
  size: number
  d1: number | null
  d7: number | null
  d30: number | null
}
export type FunnelStatModel = {
  step: 'signedUp' | 'verified' | 'baseDeployed' | 'firstScript' | 'firstResource' | 'tutorialCompleted'
  users: number
}
export type AchievementRateModel = {
  id: string
  unlocked: number
  /** Of all players, 0 to 1 */
  share: number
}
export type AnalyticsResponse = {
  days: number
  players: number
  activity: ActivityStatsModel
  retention: RetentionCohortModel[]
  funnel: FunnelStatModel[]
  achievements: AchievementRateModel[]
}
export type DevToolsStatusResponse = {
  isEnabled: boolean
}
export type TestPlayerModel = {
  userId: string
  email: string
  password: string
  botPassword: string
  baseId: string | null
}
export type SeedWorldResponse = {
  players: TestPlayerModel[]
}
export type SeedWorldDto = {
  reason: string
  /** How many test players to create, each with a base */
  count: number
}
export type RemoveTestPlayersResponse = {
  removed: number
}
export type RecipeResourceResponse = {
  resource: 'iron' | 'stone' | 'wood' | 'oil' | 'crystal' | 'gold'
  amount: number
}
export type ResearchCostResponse = {
  resources: RecipeResourceResponse[]
  /** ms */
  timeMs: number
}
export type RecipeResponse = {
  /** The module the recipe builds */
  module: string
  /** Class 1 is the base set every player knows */
  classLevel: number
  resources: RecipeResourceResponse[]
  /** ms the factory needs */
  craftTimeMs: number
  /** The player has the blueprint */
  isKnown: boolean
  /** The player can research it: the class below it is known */
  canResearch: boolean
  /** Classes above 1 only */
  research: ResearchCostResponse | null
}
export type DriveResponse = {
  _id: string
  botId: string
  /** What `cd` takes; unique among the drives of a bot */
  name: string
  /** bytes */
  quota: number
  /** bytes */
  used: number
}
export type FileResponse = {
  _id: string
  driveId: string
  /** Slash-separated path from the root of the drive */
  path: string
  kind: 'file' | 'directory'
  /** bytes */
  size: number
  /** Only when the file is read, not in listings */
  content?: string
}
export type WriteFileDto = {
  path: string
  content: string
}
export type MakeDirectoryDto = {
  path: string
}
export type BotLastPositionResponse = {
  x: number
  y: number
  z?: number
}
export type BotResponse = {
  _id: string
  label?: string
  /** Only a base has an owner */
  userId?: string
  /** Any other bot belongs to a base */
  baseId?: string
  type: 'base' | 'worker'
  /** Only a bot whose modules were all taken apart: it has no cell on the map, just its last place */
  lastPosition?: BotLastPositionResponse
}
export type ModuleResponse = {
  _id: string
  botId: string
  type:
    | 'engine'
    | 'movement'
    | 'weapon'
    | 'mining'
    | 'manipulator'
    | 'drive'
    | 'processor'
    | 'wirelessAdapter'
    | 'battery'
    | 'storage'
    | 'armor'
    | 'scanner'
    | 'generator'
    | 'solarPanel'
    | 'factory'
    | 'gps'
    | 'repair'
  name: string
  /** Hit points left; 0 means broken */
  condition: number
  maxCondition: number
  /** kg */
  weight: number
  operationCost: number
  idleCost: number
}
export type LocationModel = {
  x: number
  y: number
  /** Reserved: the world is 2D */
  z?: number
}
export type ResourceStackModel = {
  resource: 'iron' | 'stone' | 'wood' | 'oil' | 'crystal' | 'gold'
  /** What is left of the deposit */
  amount: number
}
export type MapPointResponse = {
  _id: string
  location: LocationModel
  /** Set on a point of a player's knowledge */
  userId?: string
  contentId: string | null
  type: ('resource' | 'bot' | 'item' | 'base' | 'corpse_base') | null
  resource?: ResourceStackModel
  /** The game tick the snapshot was taken at */
  seenAt?: number
}
export type DeployedBaseResponse = {
  bot: BotResponse
  modules: ModuleResponse[]
  mapPoint: MapPointResponse
}
export type DeployBaseDto = {
  password: string
  spawnSeed?: string
}
export type ItemModel = {
  _id: string
  type: 'blueprint' | 'ammunition' | 'part'
  name: string
  /** kg */
  weight: number
}
export type BotStorageResponse = {
  capacity: number
  used: number
  resources: ResourceStackModel[]
  items: ItemModel[]
  carriedWeight: number
  loadCapacity: number
}
export type ManualActionResponse = {
  ok: boolean
  /** What the call returned */
  data?: object
  /** Why the call failed, for example BLOCKED or OUT_OF_RANGE */
  code?: string
  msg?: string
}
export type ManualActionDto = {
  fn: string
  /** The arguments of the call, as a script would pass them */
  args?: object[]
}
export type FactoryJobResponse = {
  kind: 'craft' | 'research'
  module: string
  /** When the job is done, in ms */
  readyAt: number
}
export type ItemResponse = {
  _id: string
  type: 'blueprint' | 'ammunition' | 'part'
  /** For a part or a blueprint: the module it is */
  name: string
  /** kg */
  weight: number
}
export type FactoryStatusResponse = {
  /** The game clock when the status was taken, in ms */
  now: number
  jobs: FactoryJobResponse[]
  /** Finished modules, ready to be assembled into a bot */
  parts: ItemResponse[]
  /** Blueprints found or looted and not yet learned */
  blueprintItems: ItemResponse[]
}
export type CraftDto = {
  /** The module to craft */
  module: string
  count?: number
}
export type ResearchDto = {
  /** The module whose blueprint to research */
  module: string
}
export type BlueprintResponse = {
  userId: string
  module: string
  source: 'research' | 'item'
}
export type LearnDto = {
  /** A blueprint item held by the base */
  itemId: string
}
export type AssembledBotResponse = {
  bot: BotResponse
  modules: ModuleResponse[]
  mapPoint: MapPointResponse
}
export type AssembleDto = {
  label?: string
  /** Module parts held by the base */
  partIds: string[]
}
export type MaintenanceDto = {
  /** The bot on an adjacent cell whose module is worked on */
  targetBotId: string
  /** The module to repair or take apart */
  moduleId: string
}
export type ScrapResponse = {
  resource: 'iron' | 'stone' | 'wood' | 'oil' | 'crystal' | 'gold'
  amount: number
}
export type DisassemblyResponse = {
  /** A share of the recipe resources, now in the storage of the bot */
  scrap: ScrapResponse[]
  /** A blueprint item of the module, by chance */
  blueprint: ItemResponse | null
}
export type BotPositionResponse = {
  x: number
  y: number
}
export type CategorySwitchesModel = {
  movement: boolean
  combat: boolean
  extraction: boolean
  logistics: boolean
  fabrication: boolean
  maintenance: boolean
  communication: boolean
  trade: boolean
}
export type GameSettingsResponse = {
  categories: CategorySwitchesModel
}
export type UserSettingsModel = {
  categories: CategorySwitchesModel
  reducedMotion: boolean | null
}
export type SettingsResponse = {
  global: GameSettingsResponse
  user: UserSettingsModel
  /** What the player can use: the game and the player switches together */
  effective: CategorySwitchesModel
}
export type CategorySwitchesPatchModel = {
  movement?: boolean
  combat?: boolean
  extraction?: boolean
  logistics?: boolean
  fabrication?: boolean
  maintenance?: boolean
  communication?: boolean
  trade?: boolean
}
export type UpdateUserSettingsDto = {
  categories?: CategorySwitchesPatchModel
  /** Reduce motion; null follows the system */
  reducedMotion?: boolean | null
}
export type UpdateGameSettingsDto = {
  categories: CategorySwitchesPatchModel
}
export type TutorialStepResponse = {
  id: 'openTerminal' | 'listModules' | 'scan' | 'writeScript' | 'runScript' | 'craft' | 'assemble'
  isDone: boolean
}
export type TutorialResponse = {
  status: 'active' | 'skipped' | 'completed'
  steps: TutorialStepResponse[]
  /** The first step not done, while the tutorial is active */
  current: ('openTerminal' | 'listModules' | 'scan' | 'writeScript' | 'runScript' | 'craft' | 'assemble') | null
}
export type AchievementResponse = {
  /** For example `prospector.2` */
  id: string
  /** The idea it belongs to; its texts are the translation keys of the family */
  family: string
  level: number
  /** How many levels the family has */
  levels: number
  /** What the counter must reach to unlock it */
  threshold: number
  /** Where the counter is now, at most the threshold */
  progress: number
  /** When it was unlocked (ms since the epoch) */
  unlockedAt: number | null
}
export type NotificationResponse = {
  id: string
  category: 'attacks' | 'damage' | 'scripts' | 'security' | 'fabrication' | 'trade' | 'achievements' | 'system'
  /** What happened, for example `underAttack`; the translation key of its text */
  kind: string
  /** What the text needs, such as the module or the number of bars */
  params: {
    [key: string]: string | number | boolean
  }
  botId: string | null
  /** How many times it happened (repeated events are coalesced) */
  count: number
  /** When it happened (ms since the epoch); the last time for a coalesced one */
  createdAt: number
  readAt: number | null
}
export type NotificationListResponse = {
  items: NotificationResponse[]
  /** How many the player has not read, in all */
  unread: number
}
export type NotificationSummaryResponse = {
  unread: number
  /** Unread, by category */
  byCategory: {
    [key: string]: number
  }
}
export type MarkedReadResponse = {
  /** How many were marked as read */
  marked: number
}
export type MarkReadDto = {
  /** The notifications to mark as read; every one when left out */
  ids?: string[]
}
export type NotificationPreferencesResponse = {
  /** Which categories the player wants to hear about */
  categories: {
    attacks?: boolean
    damage?: boolean
    scripts?: boolean
    security?: boolean
    fabrication?: boolean
    trade?: boolean
    achievements?: boolean
    system?: boolean
  }
}
export type UpdateNotificationPreferencesDto = {
  categories?: {
    attacks?: boolean
    damage?: boolean
    scripts?: boolean
    security?: boolean
    fabrication?: boolean
    trade?: boolean
    achievements?: boolean
    system?: boolean
  }
}
export type ExecutionResponse = {
  id: string
  botId: string
  file: string
  args: string[]
  state: 'queued' | 'running' | 'suspended' | 'awaiting' | 'finished' | 'killed'
  reason: string | null
  restarts: number
}
export type StartExecutionDto = {
  /** The script, as /<drive>/<path> on the drives of the bot */
  file: string
  /** Arguments of main(bot, ...args): strings, numbers or booleans */
  args?: string[]
}
export type TerminalLogEntryResponse = {
  _id: string
  sessionId: string
  botId: string
  at: number
  kind: 'input' | 'output' | 'error' | 'security'
  text: string
}
export type HealthResponse = {
  status: 'ok'
  database?: 'up'
  /** Present when Redis is configured */
  redis?: 'up'
  /** Present when the node uses the engine */
  engine?: 'up'
}
export type MetricHealthModel = {
  id: string
  area: 'engine' | 'scripts' | 'api' | 'infrastructure'
  unit: string
  value: number | null
  status: 'green' | 'yellow' | 'red'
}
export type AreaHealthModel = {
  area: 'engine' | 'scripts' | 'api' | 'infrastructure'
  status: 'green' | 'yellow' | 'red'
  metrics: MetricHealthModel[]
}
export type AlertResponse = {
  _id: string
  metric: string
  area: 'engine' | 'scripts' | 'api' | 'infrastructure'
  severity: 'yellow' | 'red'
  value: number
  threshold: number
  /** Milliseconds since the epoch */
  openedAt: number
  clearedAt: number | null
  acknowledgedAt: number | null
  acknowledgedBy: string | null
}
export type HealthReportResponse = {
  /** Milliseconds since the epoch */
  sampledAt: number | null
  status: 'green' | 'yellow' | 'red'
  areas: AreaHealthModel[]
  alerts: AlertResponse[]
}
export type MetricSeriesResponse = {
  metric: string
  stepMs: number
  points: number[][]
}
export type DayPhaseSpanResponse = {
  phase: 'night' | 'morning' | 'day' | 'evening'
  /** In-game hour at which this part of the day starts */
  fromHour: number
  /** How much sun reaches solar panels, from 0 to 1 */
  sunlight: number
}
export type GameTimeConfigResponse = {
  /** One in-game day in real milliseconds; the world clock counts from the Unix epoch */
  dayLengthMs: number
  hoursPerDay: number
  spans: DayPhaseSpanResponse[]
}
export type GameTimeResponse = {
  /** The server instant in ms */
  now: number
  config: GameTimeConfigResponse
}
export type ApiKeyResponse = {
  _id: string
  name: string
  prefix: string
  scopes: (
    | 'read'
    | 'base'
    | 'files'
    | 'scripts'
    | 'terminal'
    | 'movement'
    | 'combat'
    | 'extraction'
    | 'logistics'
    | 'fabrication'
    | 'maintenance'
    | 'communication'
    | 'trade'
  )[]
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
  revokedAt: number | null
}
export type CreatedApiKeyResponse = {
  _id: string
  name: string
  prefix: string
  scopes: (
    | 'read'
    | 'base'
    | 'files'
    | 'scripts'
    | 'terminal'
    | 'movement'
    | 'combat'
    | 'extraction'
    | 'logistics'
    | 'fabrication'
    | 'maintenance'
    | 'communication'
    | 'trade'
  )[]
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
  revokedAt: number | null
  /** The key itself. It is shown only now; only its hash is stored */
  secret: string
}
export type CreateApiKeyDto = {
  name: string
  /** What the key may do; it can only narrow what the player may do */
  scopes: (
    | 'read'
    | 'base'
    | 'files'
    | 'scripts'
    | 'terminal'
    | 'movement'
    | 'combat'
    | 'extraction'
    | 'logistics'
    | 'fabrication'
    | 'maintenance'
    | 'communication'
    | 'trade'
  )[]
  /** Requests per minute */
  ratePerMinute?: number
  /** The key stops working after this many days; without it the key does not expire */
  expiresInDays?: number
}
export const {
  useUsersMeQuery,
  useUsersListQuery,
  useUsersUpdateMutation,
  useAuthRegisterMutation,
  useAuthLoginMutation,
  useAuthRefreshMutation,
  useAuthLogoutMutation,
  useAuthVerifyEmailMutation,
  useAuthResendVerificationMutation,
  useAuthForgotPasswordMutation,
  useAuthResetPasswordMutation,
  useAuthChangePasswordMutation,
  useAuthRequestEmailChangeMutation,
  useAuthConfirmEmailChangeMutation,
  useAuthRequestAccountDeletionMutation,
  useAuthConfirmAccountDeletionMutation,
  useAdminMeQuery,
  useAdminEnrollMutation,
  useAdminConfirmMutation,
  useAdminVerifyMutation,
  useAuditListQuery,
  useAuditExportQuery,
  usePlayersSearchQuery,
  usePlayersProfileQuery,
  usePlayersRemoveMutation,
  usePlayersBanMutation,
  usePlayersUnbanMutation,
  usePlayersLogoutMutation,
  usePlayersResendVerificationMutation,
  usePlayersResetPasswordMutation,
  usePlayersChangeRoleMutation,
  usePlayersAddNoteMutation,
  useViewAsStartMutation,
  useViewAsExitMutation,
  useInspectorSearchQuery,
  useInspectorBotQuery,
  useInspectorFilesQuery,
  useInspectorFileQuery,
  useInspectorMapQuery,
  useInspectorHeatmapQuery,
  useSupervisionStateQuery,
  useSupervisionKillMutation,
  useSupervisionRebootMutation,
  useSupervisionQuarantineMutation,
  useSupervisionReleaseMutation,
  useSupervisionPauseMutation,
  useSupervisionResumeMutation,
  useSupervisionHaltMutation,
  useSupervisionAllowMutation,
  useSupervisionGrantMutation,
  useSupervisionCompensateMutation,
  useSupervisionRemoveMutation,
  useSupervisionRestoreMutation,
  useLogsSearchQuery,
  useLogsSlowTicksQuery,
  useSecurityOverviewQuery,
  useSecurityRevokeKeyMutation,
  useBalanceOverviewQuery,
  useBalanceStateQuery,
  useBalanceSaveMutation,
  useBalanceVersionQuery,
  useBalancePreviewMutation,
  useBalanceRollbackMutation,
  useOperationsStatusQuery,
  useOperationsAnnounceMutation,
  useOperationsSetBannerMutation,
  useOperationsClearBannerMutation,
  useOperationsRestartRuntimeMutation,
  useMaintenanceStatusQuery,
  useAnalyticsReportQuery,
  useAnalyticsExportQuery,
  useDevToolsStatusQuery,
  useDevToolsSeedWorldMutation,
  useDevToolsRemoveTestPlayersMutation,
  useCraftingRecipeListQuery,
  useFilesDrivesQuery,
  useFilesListQuery,
  useFilesReadQuery,
  useFilesWriteMutation,
  useFilesRemoveMutation,
  useFilesMakeDirectoryMutation,
  useBotsDeployBaseMutation,
  useBotsListQuery,
  useBotsBaseBotsQuery,
  useBotsModulesQuery,
  useBotsScanMutation,
  useBotControlGetStorageQuery,
  useBotControlPerformMutation,
  useFactoryStatusQuery,
  useFactoryCraftMutation,
  useFactoryResearchMutation,
  useFactoryLearnMutation,
  useFactoryAssembleMutation,
  useMaintenanceRepairMutation,
  useMaintenanceDisassembleMutation,
  useMapGetQuery,
  useMapPositionQuery,
  useSettingsGetQuery,
  useSettingsUpdateMutation,
  useAdminSettingsGetQuery,
  useAdminSettingsUpdateMutation,
  useTutorialGetQuery,
  useTutorialSkipMutation,
  useTutorialRestartMutation,
  useAchievementsListQuery,
  useNotificationsListQuery,
  useNotificationsSummaryQuery,
  useNotificationsMarkReadMutation,
  useNotificationsPreferencesQuery,
  useNotificationsUpdatePreferencesMutation,
  useExecutionsListQuery,
  useExecutionsStartMutation,
  useExecutionsKillMutation,
  useExecutionsHistoryQuery,
  useHealthReadyQuery,
  useHealthLiveQuery,
  useMonitoringHealthQuery,
  useMonitoringSeriesQuery,
  useMonitoringAlertsQuery,
  useMonitoringAcknowledgeMutation,
  useGameTimeCurrentQuery,
  useApiKeysListQuery,
  useApiKeysCreateMutation,
  useApiKeysRevokeMutation
} = injectedRtkApi
