import { IApiKey } from '../../../../lib/utils/interfaces/api-keys'
import { ApiKey } from '../domain/api-key'

export const toApiKeyDto = (key: ApiKey): IApiKey => ({
  _id: key.id,
  name: key.name,
  prefix: key.prefix,
  scopes: [...key.scopes],
  ratePerMinute: key.ratePerMinute,
  createdAt: key.createdAt.getTime(),
  lastUsedAt: key.lastUsedAt?.getTime() ?? null,
  expiresAt: key.expiresAt?.getTime() ?? null,
  revokedAt: key.revokedAt?.getTime() ?? null
})
