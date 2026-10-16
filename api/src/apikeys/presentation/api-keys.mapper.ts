import { API_SCOPES, ApiScope, IApiKey } from '../../../../lib/utils/interfaces/api-keys'
import { ApiKey } from '../domain/api-key'

export const toApiKeyDto = (key: ApiKey): IApiKey => ({
  _id: key.id,
  name: key.name,
  prefix: key.prefix,
  // Only player scopes are ever shown to a player
  scopes: key.scopes.filter((scope): scope is ApiScope => (API_SCOPES as readonly string[]).includes(scope)),
  ratePerMinute: key.ratePerMinute,
  createdAt: key.createdAt.getTime(),
  lastUsedAt: key.lastUsedAt?.getTime() ?? null,
  expiresAt: key.expiresAt?.getTime() ?? null,
  revokedAt: key.revokedAt?.getTime() ?? null
})
