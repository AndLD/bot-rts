import { ManualCategory } from './settings'

// What an API key may do (design §22.1). A key acts as its player under the same rules, so a scope can only narrow what the player
// may do, never widen it. Every route and socket event of the API names the scope it needs.
export type ApiScope =
  // Everything that only looks: bases, bots, modules, the map, files, storage, notifications, achievements, terminal history
  | 'read'
  // Deploying a base
  | 'base'
  // Writing and deleting files and directories
  | 'files'
  // Starting and stopping scripts
  | 'scripts'
  // The BotOS terminal: sessions and commands (it can do what its commands can, so grant it with care)
  | 'terminal'
  // One scope per category of manual control (design §15.1): the actions of that category, and the endpoints that belong to it
  | `${ManualCategory}`

export const API_SCOPES: readonly ApiScope[] = [
  'read',
  'base',
  'files',
  'scripts',
  'terminal',
  ...Object.values(ManualCategory)
]

export const API_KEY_PREFIX = 'botrts_'

export const API_KEY_LIMITS = {
  nameMaxLength: 60,
  // Active keys a player may hold
  maxKeysPerPlayer: 10,
  defaultRatePerMinute: 120,
  maxRatePerMinute: 6000,
  maxExpiresInDays: 365
} as const

// A key as the player sees it in the list: the secret is never shown again
export interface IApiKey {
  _id: string
  name: string
  // The first characters of the key, to tell keys apart
  prefix: string
  scopes: ApiScope[]
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number | null
  revokedAt: number | null
}

// What creating a key answers: the only time the secret is shown
export interface ICreatedApiKey extends IApiKey {
  secret: string
}

export interface ICreateApiKey {
  name: string
  scopes: ApiScope[]
  ratePerMinute?: number
  expiresInDays?: number
}
