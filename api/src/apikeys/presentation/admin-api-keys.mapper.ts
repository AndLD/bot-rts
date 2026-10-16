import { AdminApiScope, IAdminApiKey, isAdminApiScope } from '../../../../lib/utils/admin-api-keys'
import { ApiKey } from '../domain/api-key'

export const toAdminApiKeyDto = (key: ApiKey): IAdminApiKey => ({
  _id: key.id,
  name: key.name,
  prefix: key.prefix,
  scopes: key.scopes.filter((scope): scope is AdminApiScope => isAdminApiScope(scope)),
  ratePerMinute: key.ratePerMinute,
  ownerId: key.userId,
  reason: key.adminGrant?.reason ?? '',
  ipAllowList: [...(key.adminGrant?.ipAllowList ?? [])],
  createdAt: key.createdAt.getTime(),
  lastUsedAt: key.lastUsedAt?.getTime() ?? null,
  // An admin key always has an expiry
  expiresAt: key.expiresAt?.getTime() ?? 0,
  revokedAt: key.revokedAt?.getTime() ?? null
})
