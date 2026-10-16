import { ApiKey } from '../domain/api-key'
import { toAdminApiKeyDto } from './admin-api-keys.mapper'
import { toApiKeyDto } from './api-keys.mapper'

const key: ApiKey = {
  id: 'k1',
  userId: 'u1',
  name: 'Assistant',
  prefix: 'botrts_ab12',
  keyHash: 'hash',
  scopes: ['admin:logs:read'],
  ratePerMinute: 60,
  createdAt: new Date(1000),
  lastUsedAt: new Date(2000),
  expiresAt: new Date(3000),
  revokedAt: new Date(4000),
  adminGrant: { reason: 'investigating', ipAllowList: ['10.0.0.1'] }
}

describe('toAdminApiKeyDto', () => {
  it('shows the grant and the times of an admin key, never its hash', () => {
    expect(toAdminApiKeyDto(key)).toEqual({
      _id: 'k1',
      name: 'Assistant',
      prefix: 'botrts_ab12',
      scopes: ['admin:logs:read'],
      ratePerMinute: 60,
      ownerId: 'u1',
      reason: 'investigating',
      ipAllowList: ['10.0.0.1'],
      createdAt: 1000,
      lastUsedAt: 2000,
      expiresAt: 3000,
      revokedAt: 4000
    })
  })

  it('answers empty values for a key that has none of it', () => {
    expect(
      toAdminApiKeyDto({ ...key, lastUsedAt: null, expiresAt: null, revokedAt: null, adminGrant: null })
    ).toMatchObject({ reason: '', ipAllowList: [], lastUsedAt: null, expiresAt: 0, revokedAt: null })
  })

  it('shows only admin scopes, and the player mapper only player scopes', () => {
    const mixed = { ...key, scopes: ['read', 'admin:logs:read'] as ApiKey['scopes'] }

    expect(toAdminApiKeyDto(mixed).scopes).toEqual(['admin:logs:read'])
    expect(toApiKeyDto(mixed).scopes).toEqual(['read'])
  })
})
