import type { AdminPermission } from './admin'
import type { ApiScope } from './interfaces/api-keys'

// Read-only scopes an admin may put on an API key for an AI assistant (design §25.2). They are a set of their own, kept out of
// `API_SCOPES`: the key form, the generated client, the public OpenAPI spec and the player documentation list player scopes only.
// A key gets them only from the admin console, never from the key-creation endpoint of the players.
export const ADMIN_API_SCOPES = [
  'admin:logs:read',
  'admin:metrics:read',
  'admin:audit:read',
  'admin:health:read'
] as const

export type AdminApiScope = (typeof ADMIN_API_SCOPES)[number]

// What an API key may hold: player scopes, or (for a key an admin granted in the console) admin read scopes
export type GrantedScope = ApiScope | AdminApiScope

// The admin permission the owner of the key must still hold on every call, so demoting the admin ends what the key can do
export const ADMIN_SCOPE_PERMISSION: Readonly<Record<AdminApiScope, AdminPermission>> = {
  'admin:logs:read': 'logs.read',
  'admin:metrics:read': 'dashboard.read',
  'admin:audit:read': 'audit.read',
  'admin:health:read': 'dashboard.read'
}

export const ADMIN_API_KEY_LIMITS = {
  nameMaxLength: 60,
  reasonMinLength: 3,
  reasonMaxLength: 500,
  // Active admin keys one admin may hold
  maxKeysPerAdmin: 5,
  maxIpAllowList: 10,
  defaultRatePerMinute: 60,
  maxRatePerMinute: 600,
  // The ceiling of the setting `ADMIN_API_KEY_MAX_DAYS`
  maxExpiresInDaysCeiling: 365
} as const

export function isAdminApiScope(scope: string): scope is AdminApiScope {
  return (ADMIN_API_SCOPES as readonly string[]).includes(scope)
}

// An admin key as the console shows it; the secret is never shown again
export interface IAdminApiKey {
  _id: string
  name: string
  prefix: string
  scopes: AdminApiScope[]
  ratePerMinute: number
  ownerId: string
  reason: string
  ipAllowList: string[]
  createdAt: number
  lastUsedAt: number | null
  expiresAt: number
  revokedAt: number | null
}

export interface ICreatedAdminApiKey extends IAdminApiKey {
  secret: string
}

export interface ICreateAdminApiKey {
  name: string
  scopes: AdminApiScope[]
  reason: string
  expiresInDays: number
  ipAllowList?: string[]
  ratePerMinute?: number
}
