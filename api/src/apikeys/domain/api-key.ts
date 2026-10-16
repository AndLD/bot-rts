import { GrantedScope } from '../../../../lib/utils/admin-api-keys'

// The extra of an admin key (design §25.2)
export interface AdminKeyGrant {
  readonly reason: string
  // Addresses the key may be used from; empty means any
  readonly ipAllowList: readonly string[]
}

export interface ApiKey {
  readonly id: string
  readonly userId: string
  readonly name: string
  readonly prefix: string
  readonly keyHash: string
  readonly scopes: readonly GrantedScope[]
  readonly ratePerMinute: number
  readonly createdAt: Date
  readonly lastUsedAt: Date | null
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
  // Set only on a key an admin created in the console; a player key has none
  readonly adminGrant: AdminKeyGrant | null
}

export function isKeyUsable(key: ApiKey, now: Date): boolean {
  return key.revokedAt === null && (key.expiresAt === null || key.expiresAt > now)
}
