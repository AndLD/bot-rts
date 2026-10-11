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
    statisticsGet: build.query<StatisticsGetApiResponse, StatisticsGetApiArg>({
      query: () => ({ url: `/api/v1/admin/statistics` })
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
    healthCheck: build.query<HealthCheckApiResponse, HealthCheckApiArg>({
      query: () => ({ url: `/api/v1/health` })
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
  status?: 'admin' | 'owner' | 'user' | 'unlimited' | 'banned'
  /** The email is verified */
  active?: boolean
  email?: string
}
export type UsersUpdateApiResponse = /** status 200  */ UserUpdatedResponse
export type UsersUpdateApiArg = {
  id: string
  updateUserDto: UpdateUserDto
}
export type StatisticsGetApiResponse = /** status 200  */ StatisticsResponse
export type StatisticsGetApiArg = void
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
export type HealthCheckApiResponse = /** status 200  */ HealthResponse
export type HealthCheckApiArg = void
export type UserInfoResponse = {
  _id: string
  name: string
  email: string
  status: 'admin' | 'owner' | 'user' | 'unlimited' | 'banned'
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
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_FAILED'
    | 'CREDENTIALS_INVALID'
    | 'EMAIL_ALREADY_EXISTS'
    | 'EMAIL_NOT_VERIFIED'
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
    | 'COMMAND_USAGE'
    | 'NO_DRIVE_SELECTED'
    | 'DRIVE_FULL'
    | 'DRIVE_BROKEN'
    | 'ALREADY_EXISTS'
    | 'TERMINAL_SESSION_CLOSED'
    | 'TOO_MANY_REQUESTS'
    | 'INTERNAL_ERROR'
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
  status?: 'admin' | 'owner' | 'user' | 'unlimited' | 'banned'
}
export type StatisticsResponse = {
  usersByStatus?: {
    admin: number
    owner: number
    user: number
    unlimited: number
    banned: number
  }
  /** When this server instance started */
  startedAt: string
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
export type BotResponse = {
  _id: string
  label?: string
  /** Only a base has an owner */
  userId?: string
  /** Any other bot belongs to a base */
  baseId?: string
  type: 'base' | 'worker'
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
    | 'factory'
    | 'gps'
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
export type HealthResponse = {
  status: 'ok'
  database: 'up'
}
export const {
  useUsersMeQuery,
  useUsersListQuery,
  useUsersUpdateMutation,
  useStatisticsGetQuery,
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
  useHealthCheckQuery
} = injectedRtkApi
