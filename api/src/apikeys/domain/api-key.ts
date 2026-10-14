import { ApiScope } from '../../../../lib/utils/interfaces/api-keys'

export interface ApiKey {
  readonly id: string
  readonly userId: string
  readonly name: string
  readonly prefix: string
  readonly keyHash: string
  readonly scopes: readonly ApiScope[]
  readonly ratePerMinute: number
  readonly createdAt: Date
  readonly lastUsedAt: Date | null
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
}

export function isKeyUsable(key: ApiKey, now: Date): boolean {
  return key.revokedAt === null && (key.expiresAt === null || key.expiresAt > now)
}
