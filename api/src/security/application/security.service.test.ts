import { FakeClock } from '../../../tests/fakes/fakes'
import { ApiKeyService } from '../../apikeys/application/api-key.service'
import { RateLimitHits } from '../../apikeys/application/rate-limit-hits'
import { EnginePort } from '../../engine/application/engine-port'
import { KeyRow, SecurityReadModel } from './ports'
import { SecurityService } from './security.service'

const key = (overrides: Partial<KeyRow> = {}): KeyRow => ({
  id: 'k1',
  name: 'Dashboard',
  prefix: 'botrts_ab12',
  scopes: ['read'],
  ratePerMinute: 120,
  createdAt: new Date(1000),
  lastUsedAt: new Date(2000),
  expiresAt: null,
  revokedAt: null,
  owner: { id: 'u1', name: 'Alice' },
  ...overrides
})

function setup(top: EnginePort['top'] = async () => []) {
  const clock = new FakeClock()
  const calls: Array<[string, ...unknown[]]> = []
  const readModel: SecurityReadModel = {
    failedLoginsByIp: async (since) => (
      calls.push(['ip', since]),
      [{ key: '1.1.1.1', failures: 9, distinctEmails: 4, lastAt: 5 }]
    ),
    failedLoginsByEmail: async () => [{ key: 'a@b.c', failures: 6, distinctEmails: 1, lastAt: 6 }],
    sameIpAccounts: async (_since, min) => (
      calls.push(['same', min]),
      [{ ip: '2.2.2.2', accounts: [{ _id: 'u1', name: 'Alice' }] }]
    ),
    multiIpAccounts: async (_since, min) => (calls.push(['multi', min]), [{ _id: 'u1', name: 'Alice', ips: 4 }]),
    botLockouts: async () => [
      { botId: 'b1', label: null, ownerId: null, ownerName: null, failures: 5, lockedUntil: 9 }
    ],
    apiKeys: async () => [
      key(),
      key({ id: 'k2', lastUsedAt: null, expiresAt: new Date(9000), revokedAt: new Date(5000) })
    ],
    failedScripts: async (_since, codes) => (
      calls.push(['codes', ...codes]),
      [
        {
          executionId: 'e1',
          owner: { _id: 'u1', name: 'Alice' },
          botId: 'b1',
          file: '/m/a.js',
          reason: 'TIME_LIMIT: the slice was exceeded',
          endedAt: 7
        }
      ]
    )
  }
  const hits = new RateLimitHits()
  const keys = { revokeAsAdmin: jest.fn(async () => ({ userId: 'u1', scopes: ['read'] })) }
  const service = new SecurityService(
    readModel,
    hits,
    keys as unknown as ApiKeyService,
    { top } as unknown as EnginePort,
    clock
  )

  return { service, hits, keys, clock, calls }
}

describe('SecurityService', () => {
  it('puts the lists together for a window of hours', async () => {
    const { service, hits, clock, calls } = setup(async (limit) => [
      { id: 'e9', userId: 'u1', botId: 'b1', file: '/m/a.js', opsUsed: 500, ticks: limit }
    ])
    hits.record('k1', clock.now().getTime() - 1000)

    const overview = await service.overview(6)

    expect(overview.hours).toBe(6)
    expect(overview.failedLoginsByIp).toHaveLength(1)
    expect(overview.failedLoginsByEmail[0].key).toBe('a@b.c')
    expect(overview.sameIpAccounts[0].ip).toBe('2.2.2.2')
    expect(overview.multiIpAccounts[0].ips).toBe(4)
    expect(overview.botLockouts).toHaveLength(1)
    expect(overview.apiKeys).toEqual([
      expect.objectContaining({
        _id: 'k1',
        isRevoked: false,
        rateLimitHits: 1,
        lastUsedAt: 2000,
        expiresAt: null,
        owner: { _id: 'u1', name: 'Alice' }
      }),
      expect.objectContaining({ _id: 'k2', isRevoked: true, rateLimitHits: 0, lastUsedAt: null, expiresAt: 9000 })
    ])
    expect(overview.suspiciousScripts).toEqual([expect.objectContaining({ executionId: 'e1', code: 'TIME_LIMIT' })])
    expect(overview.topConsumers).toEqual([
      { executionId: 'e9', userId: 'u1', botId: 'b1', file: '/m/a.js', opsUsed: 500, ticks: 10 }
    ])
    expect(calls).toContainEqual(['ip', new Date(clock.now().getTime() - 6 * 3_600_000)])
    expect(calls).toContainEqual(['same', 3])
    expect(calls).toContainEqual(['multi', 3])
    expect(calls).toContainEqual(['codes', 'TIME_LIMIT', 'MEMORY_LIMIT', 'SANDBOX_FAULT'])
  })

  it('shows the rest of the page when the engine does not answer', async () => {
    const { service } = setup(async () => {
      throw new Error('engine is down')
    })

    expect((await service.overview(24)).topConsumers).toBeNull()
  })

  it('revokes a key as an admin and says what changed', async () => {
    const { service, keys } = setup()

    expect(await service.revokeKey('k1')).toEqual({
      before: { owner: 'u1', scopes: ['read'] },
      after: { revoked: true }
    })
    expect(keys.revokeAsAdmin).toHaveBeenCalledWith('k1')
  })
})
